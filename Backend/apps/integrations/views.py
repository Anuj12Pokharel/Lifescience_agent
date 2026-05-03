import requests
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsSuperAdmin
from apps.integrations.admin_serializers import IntegrationProviderWriteSerializer
from apps.integrations.models import AgentIntegrationProvider, OrgIntegrationCredential
from apps.integrations.serializers import (
    AgentIntegrationProviderSerializer,
    ApiKeyConnectSerializer,
    OrgCredentialSerializer,
)
from apps.organizations.permissions import IsOrgOwner


def _ok(data=None, message="", status_code=status.HTTP_200_OK):
    body = {"success": True}
    if message:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return Response(body, status=status_code)


# ── Superadmin: manage integration providers ──────────────────────────────────

class SuperAdminProviderListView(APIView):
    """
    Superadmin defines which tools each agent supports.

    GET  /api/v1/integrations/admin/providers/
         Lists ALL providers (active + inactive), filterable by ?agent=<uuid>

    POST /api/v1/integrations/admin/providers/
         Creates a new provider for an agent.

    Example POST body for OAuth2 (Jira):
    {
      "agent": "<agent-uuid>",
      "provider": "jira",
      "display_name": "Jira",
      "logo_url": "https://example.com/jira.png",
      "auth_type": "oauth2",
      "oauth_config": {
        "auth_url": "https://auth.atlassian.com/authorize",
        "token_url": "https://auth.atlassian.com/oauth/token",
        "scopes": ["offline_access", "read:issue-details:jira", "read:issue:jira", "write:issue:jira", "delete:issue:jira", "read:comment:jira", "write:comment:jira", "read:user:jira", "read:project:jira", "read:jira-user"],
        "client_id_setting": "JIRA_CLIENT_ID",
        "client_secret_setting": "JIRA_CLIENT_SECRET",
        "extra_params": {"audience": "api.atlassian.com"}
      },
      "field_schema": []
    }

    Example POST body for API Key (Trello):
    {
      "agent": "<agent-uuid>",
      "provider": "trello",
      "display_name": "Trello",
      "auth_type": "apikey",
      "oauth_config": {},
      "field_schema": [
        {"name": "api_key", "label": "API Key", "type": "password", "optional": false},
        {"name": "token",   "label": "Token",   "type": "password", "optional": false}
      ]
    }
    """
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = AgentIntegrationProvider.objects.select_related("agent").all()
        agent_id = request.query_params.get("agent")
        if agent_id:
            qs = qs.filter(agent__id=agent_id)
        return _ok(AgentIntegrationProviderSerializer(qs, many=True).data)

    def post(self, request):
        s = IntegrationProviderWriteSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        provider = s.save()
        return _ok(
            AgentIntegrationProviderSerializer(provider).data,
            message=f"Integration provider '{provider.display_name}' created for {provider.agent.name}.",
            status_code=status.HTTP_201_CREATED,
        )


class SuperAdminProviderDetailView(APIView):
    """
    Superadmin views, updates or deletes a single provider.

    GET    /api/v1/integrations/admin/providers/<uuid>/
    PATCH  /api/v1/integrations/admin/providers/<uuid>/
    DELETE /api/v1/integrations/admin/providers/<uuid>/
    """
    permission_classes = [IsSuperAdmin]

    def _get(self, pk):
        try:
            return AgentIntegrationProvider.objects.select_related("agent").get(pk=pk)
        except AgentIntegrationProvider.DoesNotExist:
            return None

    def get(self, request, pk):
        provider = self._get(pk)
        if not provider:
            return Response({"detail": "Not found."}, status=404)
        return _ok(AgentIntegrationProviderSerializer(provider).data)

    def patch(self, request, pk):
        provider = self._get(pk)
        if not provider:
            return Response({"detail": "Not found."}, status=404)
        s = IntegrationProviderWriteSerializer(provider, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        provider = s.save()
        return _ok(
            AgentIntegrationProviderSerializer(provider).data,
            message="Integration provider updated.",
        )

    def delete(self, request, pk):
        provider = self._get(pk)
        if not provider:
            return Response({"detail": "Not found."}, status=404)
        name = provider.display_name
        agent_name = provider.agent.name
        provider.delete()
        return _ok(message=f"'{name}' removed from {agent_name}.")


# ── Providers (readable by authenticated users) ───────────────────────────────

class IntegrationProviderListView(APIView):
    """
    List active integration providers for a given agent.
    Used by admin panel to show "which tools can I connect for this agent?"
    Filter: ?agent=<uuid>
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = AgentIntegrationProvider.objects.select_related("agent").filter(is_active=True)
        agent_id = request.query_params.get("agent")
        if agent_id:
            qs = qs.filter(agent__id=agent_id)

        if request.user.role == request.user.Role.ADMIN:
            from apps.organizations.models import OrgAgentAccess
            try:
                org = request.user.owned_organization
                disabled_agent_ids = OrgAgentAccess.objects.filter(
                    org=org, is_enabled=False
                ).values_list("agent_id", flat=True)
                qs = qs.exclude(agent__id__in=disabled_agent_ids)
            except Exception:
                return Response({"detail": "No organization found."}, status=404)

        return _ok(AgentIntegrationProviderSerializer(qs, many=True).data)


# ── Category-conflict guard ───────────────────────────────────────────────────

def _provider_category(slug: str) -> str | None:
    """Return 'crm' or 'messenger' if slug belongs to that category, else None."""
    from apps.agents.execution import _CRM_PROVIDERS, _MESSENGER_PROVIDERS
    slug = slug.lower()
    if slug in _CRM_PROVIDERS:
        return "crm"
    if slug in _MESSENGER_PROVIDERS:
        return "messenger"
    return None


def _check_category_conflict(org, new_provider) -> str | None:
    """
    Return an error message if the org already has an active credential for a
    *different* provider in the same category (crm / messenger) for this agent.
    Returns None when it's safe to connect.
    """
    category = _provider_category(new_provider.provider)
    if not category:
        return None  # trackers have no limit enforced here

    from apps.agents.execution import _CRM_PROVIDERS, _MESSENGER_PROVIDERS
    category_slugs = _CRM_PROVIDERS if category == "crm" else _MESSENGER_PROVIDERS

    existing = OrgIntegrationCredential.objects.filter(
        org=org,
        provider__agent=new_provider.agent,
        is_active=True,
        provider__provider__in=category_slugs,
    ).exclude(provider=new_provider).select_related("provider").first()

    if existing:
        return (
            f"Your organization already has {existing.provider.display_name} connected "
            f"as a {category} tool for this agent. "
            f"Disconnect it first before connecting {new_provider.display_name}."
        )
    return None


# ── OAuth 2.0 flow ────────────────────────────────────────────────────────────

class OAuthInitiateView(APIView):
    """
    Step 1: Admin requests OAuth URL for a provider.
    GET /api/v1/integrations/<provider_id>/connect/
    Returns {"auth_url": "https://..."}
    """
    permission_classes = [IsOrgOwner]

    def get(self, request, provider_id):
        from apps.integrations.oauth import build_auth_url

        try:
            provider = AgentIntegrationProvider.objects.get(
                pk=provider_id,
                auth_type=AgentIntegrationProvider.AuthType.OAUTH2,
                is_active=True,
            )
        except AgentIntegrationProvider.DoesNotExist:
            return Response({"detail": "Provider not found or not OAuth2."}, status=404)

        org = request.user.owned_organization

        from apps.organizations.models import OrgAgentAccess
        if OrgAgentAccess.objects.filter(
            org=org, agent=provider.agent, is_enabled=False
        ).exists():
            return Response(
                {"detail": "This agent is not enabled for your organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        conflict = _check_category_conflict(org, provider)
        if conflict:
            return Response({"detail": conflict}, status=status.HTTP_400_BAD_REQUEST)

        try:
            auth_url = build_auth_url(provider, str(org.id), str(request.user.id))
        except KeyError as e:
            return Response(
                {"detail": f"OAuth config missing key: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return _ok({"auth_url": auth_url})


class OAuthCallbackView(APIView):
    """
    Step 2: Provider redirects here after admin approves.
    GET /api/v1/integrations/callback/?code=X&state=Y
    Public endpoint — state carries authentication info.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from apps.integrations.oauth import exchange_code

        code = request.query_params.get("code")
        state = request.query_params.get("state")
        error = request.query_params.get("error")

        if error:
            return Response(
                {"success": False, "error": error, "detail": request.query_params.get("error_description", "")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not code or not state:
            return Response(
                {"detail": "Missing code or state parameter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            credential = exchange_code(code, state)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except requests.HTTPError as e:
            return Response(
                {"detail": f"Token exchange failed: {e.response.text}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as e:
            return Response(
                {"detail": f"Unexpected error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return _ok(
            OrgCredentialSerializer(credential).data,
            message=f"{credential.provider.display_name} connected successfully.",
        )


# ── API Key connect ───────────────────────────────────────────────────────────

class ApiKeyConnectView(APIView):
    """
    Admin manually saves API key credentials for a provider.
    POST /api/v1/integrations/connect/apikey/
    """
    permission_classes = [IsOrgOwner]

    def post(self, request):
        s = ApiKeyConnectSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        org = request.user.owned_organization
        conflict = _check_category_conflict(org, s.validated_data["_provider"])
        if conflict:
            return Response({"detail": conflict}, status=status.HTTP_400_BAD_REQUEST)
        credential = s.save(org=org, connected_by=request.user)
        return _ok(
            OrgCredentialSerializer(credential).data,
            message=f"{credential.provider.display_name} connected.",
            status_code=status.HTTP_201_CREATED,
        )


# ── Org credentials management ────────────────────────────────────────────────

class OrgCredentialListView(APIView):
    """Admin sees all connected integrations for their org."""
    permission_classes = [IsOrgOwner]

    def get(self, request):
        org = request.user.owned_organization
        creds = OrgIntegrationCredential.objects.filter(
            org=org, is_active=True
        ).select_related("provider", "provider__agent", "connected_by")
        return _ok(OrgCredentialSerializer(creds, many=True).data)


class OrgCredentialDisconnectView(APIView):
    """Admin disconnects (deactivates) an integration."""
    permission_classes = [IsOrgOwner]

    def delete(self, request, pk):
        org = request.user.owned_organization
        try:
            cred = OrgIntegrationCredential.objects.get(pk=pk, org=org)
        except OrgIntegrationCredential.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        # Wipe tokens before deactivating
        cred.access_token = ""
        cred.refresh_token = ""
        cred.extra_data = ""
        cred.is_active = False
        cred.save()
        return _ok(message=f"{cred.provider.display_name} disconnected.")


# ── Messenger config (default channel etc.) ──────────────────────────────────

class MessengerConfigView(APIView):
    """
    Admin saves messenger config for an agent after OAuth.

    PATCH /api/v1/integrations/messenger-config/
    Body: { "agent_slug": "project-tracking-agent", "default_channel": "C0XXXXXXX" }

    Also accepts: "messenger" (slug), any extra config fields.
    Stores into OrgAgentConfig.
    """
    permission_classes = [IsOrgOwner]

    def patch(self, request):
        from apps.organizations.models import OrgAgentConfig
        from apps.agents.models import Agent

        org = request.user.owned_organization
        agent_slug = request.data.get("agent_slug", "").strip()
        if not agent_slug:
            return Response({"detail": "agent_slug is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            agent = Agent.objects.get(slug=agent_slug)
        except Agent.DoesNotExist:
            return Response({"detail": "Agent not found."}, status=404)

        config, _ = OrgAgentConfig.objects.get_or_create(org=org, agent=agent)

        if "default_channel" in request.data:
            config.default_channel = request.data["default_channel"]
        if "messenger" in request.data:
            config.messenger = request.data["messenger"]

        config.save()
        return _ok(data={
            "agent_slug": agent_slug,
            "messenger": config.messenger,
            "default_channel": config.default_channel,
        }, message="Messenger config saved.")


# ── Credential resolver (internal — used by agent execution layer) ────────────

def resolve_credential_for_user(user, agent) -> OrgIntegrationCredential | None:
    """
    Given a user and an agent, return the active credential for the org this user
    belongs to. Auto-refreshes expired OAuth tokens.

    Returns None if no credential is configured.
    """
    from apps.integrations.oauth import get_valid_credential

    try:
        membership = user.org_memberships.select_related("org").get(is_active=True)
        org = membership.org
    except Exception:
        # Admin users own the org directly
        try:
            org = user.owned_organization
        except Exception:
            return None

    cred = (
        OrgIntegrationCredential.objects
        .filter(org=org, provider__agent=agent, is_active=True)
        .select_related("provider")
        .first()
    )
    if not cred:
        return None

    return get_valid_credential(cred)


# ── Gmail OAuth (per-org invitation sender) ────────────────────────────────────

GMAIL_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile"
GMAIL_SCOPES    = "https://www.googleapis.com/auth/gmail.send email profile"


class GmailConnectView(APIView):
    """
    Step 1 of Gmail OAuth.
    GET /api/v1/integrations/gmail/connect/
    Returns {"auth_url": "https://accounts.google.com/..."}
    Admin opens this URL in a popup, approves, and Google redirects to /gmail/callback/.
    """
    permission_classes = [IsOrgOwner]

    def get(self, request):
        import os, secrets, urllib.parse
        from django.core.cache import cache
        from apps.integrations.encryption import encrypt

        org = request.user.owned_organization
        state = secrets.token_urlsafe(32)
        payload = {"org_id": str(org.id), "user_id": str(request.user.id)}
        import json
        cache.set(f"gmail_state:{state}", encrypt(json.dumps(payload)), timeout=600)

        client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
        redirect_uri = request.build_absolute_uri("/api/v1/integrations/gmail/callback/")
        
        # DEBUG: Log the redirect URI to container logs
        print(f"DEBUG: Gmail OAuth redirect_uri: {redirect_uri}")

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": GMAIL_SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        auth_url = GMAIL_AUTH_URL + "?" + urllib.parse.urlencode(params)
        return _ok({"auth_url": auth_url})


class GmailCallbackView(APIView):
    """
    Step 2: Google redirects here after admin grants permission.
    GET /api/v1/integrations/gmail/callback/?code=X&state=Y
    Exchanges code for tokens, fetches Gmail address, stores credential.
    Redirects to frontend admin org settings page.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        import os, json
        from django.core.cache import cache
        from django.shortcuts import redirect
        from apps.integrations.encryption import decrypt, encrypt
        from apps.integrations.gmail_models import GmailCredential
        from django.utils import timezone

        code  = request.query_params.get("code")
        state = request.query_params.get("state")
        error = request.query_params.get("error")
        frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:3000")

        if error:
            return redirect(f"{frontend_base}/admin/organization?gmail=error&reason={error}")

        raw = cache.get(f"gmail_state:{state}")
        if not raw:
            return redirect(f"{frontend_base}/admin/organization?gmail=error&reason=state_expired")
        cache.delete(f"gmail_state:{state}")

        try:
            payload = json.loads(decrypt(raw))
        except Exception:
            return redirect(f"{frontend_base}/admin/organization?gmail=error&reason=invalid_state")

        from apps.organizations.models import Organization
        from apps.accounts.models import CustomUser

        try:
            org  = Organization.objects.get(pk=payload["org_id"])
            user = CustomUser.objects.get(pk=payload["user_id"])
        except Exception:
            return redirect(f"{frontend_base}/admin/organization?gmail=error&reason=not_found")

        client_id     = os.environ.get("GOOGLE_CLIENT_ID", "")
        client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
        redirect_uri  = request.build_absolute_uri("/api/v1/integrations/gmail/callback/")

        token_resp = requests.post(
            GMAIL_TOKEN_URL,
            data={
                "grant_type":    "authorization_code",
                "code":          code,
                "redirect_uri":  redirect_uri,
                "client_id":     client_id,
                "client_secret": client_secret,
            },
            timeout=15,
        )
        if not token_resp.ok:
            return redirect(f"{frontend_base}/admin/organization?gmail=error&reason=token_exchange_failed")

        token_data = token_resp.json()
        access_token  = token_data.get("access_token", "")
        refresh_token = token_data.get("refresh_token", "")
        expires_in    = token_data.get("expires_in")

        # Fetch the Gmail address
        profile_resp = requests.get(
            GMAIL_PROFILE_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        gmail_email = ""
        if profile_resp.ok:
            gmail_email = profile_resp.json().get("emailAddress", "")

        cred, _ = GmailCredential.objects.get_or_create(org=org)
        cred.gmail_email   = gmail_email
        cred.connected_by  = user
        cred.is_active     = True
        cred.set_access_token(access_token)
        if refresh_token:
            cred.set_refresh_token(refresh_token)
        if expires_in:
            cred.token_expiry = timezone.now() + timezone.timedelta(seconds=int(expires_in))
        cred.save()

        return redirect(f"{frontend_base}/admin/organization?gmail=connected&email={gmail_email}")


class GmailStatusView(APIView):
    """
    GET /api/v1/integrations/gmail/status/
    Returns whether Gmail is connected for the admin's org.
    """
    permission_classes = [IsOrgOwner]

    def get(self, request):
        from apps.integrations.gmail_models import GmailCredential
        org = getattr(request.user, "owned_organization", None)
        if not org:
            return _ok({"connected": False, "gmail_email": None})
        cred = GmailCredential.objects.filter(org=org, is_active=True).first()
        if cred:
            return _ok({"connected": True, "gmail_email": cred.gmail_email})
        return _ok({"connected": False, "gmail_email": None})


class GmailDisconnectView(APIView):
    """
    DELETE /api/v1/integrations/gmail/disconnect/
    Removes the stored Gmail credential.
    """
    permission_classes = [IsOrgOwner]

    def delete(self, request):
        from apps.integrations.gmail_models import GmailCredential
        org = request.user.owned_organization
        GmailCredential.objects.filter(org=org).update(
            is_active=False, access_token="", refresh_token=""
        )
        return _ok(message="Gmail disconnected.")

