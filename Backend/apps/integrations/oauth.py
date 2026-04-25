"""
OAuth 2.0 helper service.

Flow:
  1. Frontend calls GET /api/v1/integrations/{provider_id}/connect/
     → returns {"auth_url": "https://..."}  (admin opens in browser/popup)

  2. Provider redirects to GET /api/v1/integrations/callback/?code=X&state=Y
     → backend exchanges code for tokens, encrypts and saves credential
     → returns success JSON (frontend reads popup result or redirects)
"""
import json
import os
import secrets
import urllib.parse

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from apps.integrations.encryption import decrypt, encrypt
from apps.integrations.models import AgentIntegrationProvider, OrgIntegrationCredential


_STATE_TTL = 600  # 10 minutes


def _get_setting(name: str) -> str:
    """
    Read an integration credential from environment variables directly.
    python-decouple doesn't auto-populate Django settings, so we read os.environ.
    Falls back to Django settings for any value explicitly set there.
    """
    return os.environ.get(name) or getattr(settings, name, "") or ""


# ── State helpers (stored in Redis/cache) ─────────────────────────────────────

def _make_state(org_id: str, provider_id: str, user_id: str) -> str:
    state = secrets.token_urlsafe(32)
    payload = json.dumps({"org_id": org_id, "provider_id": provider_id, "user_id": user_id})
    cache.set(f"oauth_state:{state}", encrypt(payload), timeout=_STATE_TTL)
    return state


def _consume_state(state: str) -> dict:
    """Retrieve and delete state from cache. Raises ValueError if invalid."""
    key = f"oauth_state:{state}"
    raw = cache.get(key)
    if not raw:
        raise ValueError("OAuth state is invalid or has expired.")
    cache.delete(key)
    return json.loads(decrypt(raw))


# ── Build authorization URL ───────────────────────────────────────────────────

def build_auth_url(provider: AgentIntegrationProvider, org_id: str, user_id: str) -> str:
    cfg = provider.oauth_config
    state = _make_state(str(org_id), str(provider.id), str(user_id))

    client_id = _get_setting(cfg["client_id_setting"])
    redirect_uri = _redirect_uri()

    scopes = cfg.get("scopes", [])
    if isinstance(scopes, str):
        scopes = [s.strip() for s in scopes.replace(",", " ").split() if s.strip()]
    elif not isinstance(scopes, list):
        scopes = []

    extra = cfg.get("extra_params", {})
    if isinstance(extra, str):
        # handle "key=value\nkey2=value2" format
        parsed = {}
        for line in extra.splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                parsed[k.strip()] = v.strip()
        extra = parsed
    elif not isinstance(extra, dict):
        extra = {}

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(scopes),
        "state": state,
    }
    params.update(extra)

    return cfg["auth_url"] + "?" + urllib.parse.urlencode(params)


# ── Exchange code for tokens ──────────────────────────────────────────────────

def exchange_code(code: str, state: str) -> OrgIntegrationCredential:
    """
    Validate state, exchange code for tokens, encrypt and persist credential.
    Returns the saved OrgIntegrationCredential instance.
    """
    from apps.accounts.models import CustomUser
    from apps.organizations.models import Organization

    state_data = _consume_state(state)
    org = Organization.objects.get(pk=state_data["org_id"])
    provider = AgentIntegrationProvider.objects.get(pk=state_data["provider_id"])
    user = CustomUser.objects.get(pk=state_data["user_id"])

    cfg = provider.oauth_config
    client_id = _get_setting(cfg["client_id_setting"])
    client_secret = _get_setting(cfg["client_secret_setting"])

    resp = requests.post(
        cfg["token_url"],
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": _redirect_uri(),
            "client_id": client_id,
            "client_secret": client_secret,
        },
        headers={"Accept": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    token_data = resp.json()

    credential, _ = OrgIntegrationCredential.objects.get_or_create(
        org=org,
        provider=provider,
        defaults={"connected_by": user},
    )
    credential.connected_by = user
    credential.set_access_token(token_data.get("access_token", ""))
    credential.set_refresh_token(token_data.get("refresh_token", ""))
    credential.is_active = True

    expires_in = token_data.get("expires_in")
    if expires_in:
        credential.token_expiry = timezone.now() + timezone.timedelta(seconds=int(expires_in))
    else:
        credential.token_expiry = None

    # Save provider-specific extras (scope, token_type, etc.)
    extras = {k: v for k, v in token_data.items() if k not in ("access_token", "refresh_token", "expires_in")}

    # ── Merge static_extra from oauth_config (e.g. fixed base_url for Linear) ─
    static_extra = cfg.get("static_extra", {})
    if isinstance(static_extra, dict):
        extras.update(static_extra)

    # ── Fetch cloud/site URL if provider declares a resources_url ─────────────
    # e.g. Atlassian: oauth_config["resources_url"] = "https://api.atlassian.com/oauth/token/accessible-resources"
    resources_url = cfg.get("resources_url", "").strip()
    if resources_url:
        try:
            r = requests.get(
                resources_url,
                headers={
                    "Authorization": f"Bearer {token_data.get('access_token', '')}",
                    "Accept": "application/json",
                },
                timeout=10,
            )
            r.raise_for_status()
            sites = r.json()  # list of accessible resources
            if isinstance(sites, list) and sites:
                # Pick the first site (admins can have only one Jira cloud in most setups)
                site = sites[0]
                extras["base_url"] = site.get("url", "")      # e.g. https://acme.atlassian.net
                extras["cloud_id"] = site.get("id", "")       # used for Jira REST API v3
                extras["site_name"] = site.get("name", "")
        except Exception:
            pass  # non-fatal — agent will still work if base_url is absent

    if extras:
        credential.set_extra_data(extras)

    credential.save()
    return credential


# ── Token refresh ─────────────────────────────────────────────────────────────

def refresh_access_token(credential: OrgIntegrationCredential) -> OrgIntegrationCredential:
    """Use refresh_token to get a new access_token. Saves in-place."""
    provider = credential.provider
    cfg = provider.oauth_config
    client_id = _get_setting(cfg["client_id_setting"])
    client_secret = _get_setting(cfg["client_secret_setting"])

    resp = requests.post(
        cfg["token_url"],
        data={
            "grant_type": "refresh_token",
            "refresh_token": credential.get_refresh_token(),
            "client_id": client_id,
            "client_secret": client_secret,
        },
        headers={"Accept": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    token_data = resp.json()

    credential.set_access_token(token_data.get("access_token", ""))
    if "refresh_token" in token_data:
        credential.set_refresh_token(token_data["refresh_token"])
    expires_in = token_data.get("expires_in")
    if expires_in:
        credential.token_expiry = timezone.now() + timezone.timedelta(seconds=int(expires_in))
    credential.save()
    return credential


# ── Utility ───────────────────────────────────────────────────────────────────

def _redirect_uri() -> str:
    base = getattr(settings, "BACKEND_URL", "http://localhost:8000")
    return f"{base}/api/v1/integrations/callback/"


def get_valid_credential(credential: OrgIntegrationCredential) -> OrgIntegrationCredential:
    """Return credential with a valid (non-expired) access token, refreshing if needed."""
    if credential.is_expired and credential.get_refresh_token():
        return refresh_access_token(credential)
    return credential
