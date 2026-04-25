"""
Agent execution layer.
Resolves credentials for the requesting user and forwards the request to n8n.

n8n payload format:
  {
    "company_id": "<org_uuid>",
    "sessionId": "<uuid>",
    "userId": "<user_uuid>",
    "userName": "<email>",
    "userEmail": "<email>",
    "channel": "web",
    "message": "<user message>",
    "tracker": "jira",
    "tracker_creds": {"base_url": "...", "auth_header": "Bearer ..."},
    "messenger": "slack",
    "messenger_creds": {...},
    "crm": "gohighlevel",
    "crm_creds": {"auth_header": "Bearer ...", "location_id": "..."},
    "gemini_api_key": "...",
    "conversationHistory": []
  }
"""
import os
import uuid as uuid_lib

import requests


# Provider type routing — extend these sets as new integrations are added
_TRACKER_PROVIDERS = {
    "jira", "trello", "asana", "linear", "monday",
    "clickup", "github", "gitlab", "basecamp",
}
_MESSENGER_PROVIDERS = {
    "slack", "whatsapp", "teams", "discord",
    "telegram", "mattermost", "zoom",
}
_CRM_PROVIDERS = {
    "gohighlevel", "ghl", "hubspot", "salesforce", "zoho", "pipedrive",
}


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_org_for_user(user):
    """
    Return the Organization this user belongs to. Checks in order:
    1. OrgMembership (user was invited to an org directly)
    2. owned_organization (user is an admin who owns the org)
    3. AgentGroupMembership → group creator's org (user is in a group)
    """
    try:
        membership = user.org_memberships.select_related("org").get(is_active=True)
        return membership.org
    except Exception:
        pass

    try:
        return user.owned_organization
    except Exception:
        pass

    try:
        from apps.agents.group_models import AgentGroupMembership
        group_membership = (
            AgentGroupMembership.objects
            .select_related("group__created_by__owned_organization")
            .filter(user=user, is_active=True, group__is_active=True)
            .first()
        )
        if group_membership and group_membership.group.created_by:
            return group_membership.group.created_by.owned_organization
    except Exception:
        pass

    return None


def _build_tracker_creds(credential) -> dict:
    from apps.integrations.oauth import get_valid_credential

    credential.refresh_from_db()
    credential = get_valid_credential(credential)
    extra = credential.get_extra_data()
    access_token = credential.get_access_token()

    base_url = (
        extra.get("base_url")
        or extra.get("url")
        or extra.get("site_url")
        or extra.get("instance_url")
        or ""
    )
    cloud_id = extra.get("cloud_id", "")

    # Auto-fetch Jira cloud_id if missing
    if access_token and not cloud_id and credential.provider.provider.lower() == "jira":
        try:
            r = requests.get(
                "https://api.atlassian.com/oauth/token/accessible-resources",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                timeout=10,
            )
            r.raise_for_status()
            sites = r.json()
            if isinstance(sites, list) and sites:
                cloud_id = sites[0].get("id", "")
                base_url = sites[0].get("url", "") or base_url
                extra["cloud_id"] = cloud_id
                extra["base_url"] = base_url
                extra["site_name"] = sites[0].get("name", "")
                credential.set_extra_data(extra)
                credential.save(update_fields=["extra_data"])
        except Exception:
            pass

    creds: dict = {}
    if base_url:
        creds["base_url"] = base_url
    if cloud_id:
        creds["cloud_id"] = cloud_id
        creds["jira_api_base"] = f"https://api.atlassian.com/ex/jira/{cloud_id}"
    if access_token:
        creds["auth_header"] = f"Bearer {access_token}"
    if not access_token and extra:
        creds.update(extra)

    return creds


def _build_messenger_creds(credential) -> dict:
    from apps.integrations.oauth import get_valid_credential

    credential = get_valid_credential(credential)
    extra = credential.get_extra_data()
    access_token = credential.get_access_token()

    creds: dict = {}
    if access_token:
        creds["auth_header"] = f"Bearer {access_token}"
    if extra:
        creds.update(extra)

    return creds


def _build_crm_creds(credential) -> dict:
    from apps.integrations.oauth import get_valid_credential

    credential = get_valid_credential(credential)
    extra = credential.get_extra_data()
    access_token = credential.get_access_token()

    creds: dict = {}
    if access_token:
        creds["auth_header"] = f"Bearer {access_token}"
    if extra:
        creds.update(extra)

    return creds


# ── Public API ────────────────────────────────────────────────────────────────

def execute_agent(user, agent, message: str, extra: dict = None) -> dict:
    from apps.integrations.models import OrgIntegrationCredential

    extra = dict(extra) if extra else {}

    try:
        refresh_credentials_if_needed()
    except Exception:
        pass

    # ── Org resolution ────────────────────────────────────────────────────────
    org = _get_org_for_user(user)

    # ── Credential resolution ─────────────────────────────────────────────────
    tracker_name = ""
    tracker_creds: dict = {}
    messenger_name = ""
    messenger_creds: dict = {}
    crm_name = ""
    crm_creds: dict = {}

    if org:
        credentials = (
            OrgIntegrationCredential.objects
            .filter(org=org, provider__agent=agent, is_active=True)
            .select_related("provider")
        )
        for cred in credentials:
            slug = cred.provider.provider.lower()
            if slug in _TRACKER_PROVIDERS and not tracker_name:
                tracker_name = slug
                tracker_creds = _build_tracker_creds(cred)
            elif slug in _MESSENGER_PROVIDERS and not messenger_name:
                messenger_name = slug
                messenger_creds = _build_messenger_creds(cred)
            elif slug in _CRM_PROVIDERS and not crm_name:
                crm_name = "gohighlevel" if slug == "ghl" else slug
                crm_creds = _build_crm_creds(cred)

    # ── Build n8n payload ─────────────────────────────────────────────────────
    session_id = extra.pop("sessionId", None) or str(uuid_lib.uuid4())
    conversation_history = extra.pop("conversationHistory", [])
    channel = extra.pop("channel", "web")

    payload = {
        "company_id": str(org.id) if org else "",
        "sessionId": session_id,
        "userId": str(user.id),
        "userName": user.email,
        "userEmail": user.email,
        "channel": channel,
        "message": message,
        "agent_slug": agent.slug,
        "tracker": tracker_name,
        "tracker_creds": tracker_creds,
        "messenger": messenger_name,
        "messenger_creds": messenger_creds,
        "crm": crm_name,
        "crm_creds": crm_creds,
        "gemini_api_key": os.environ.get("GEMINI_API_KEY", ""),
        "conversationHistory": conversation_history,
        **extra,
    }

    # ── Pre-save session so n8n can GET it immediately ────────────────────────
    try:
        from apps.organizations.models import AgentSession
        import datetime
        from django.utils import timezone
        AgentSession.objects.update_or_create(
            session_id=session_id,
            defaults={
                "org": org,
                "agent_slug": agent.slug,
                "user_id": str(user.id),
                "user_name": user.email,
                "user_email": user.email,
                "tracker": tracker_name,
                "tracker_creds": tracker_creds,
                "messenger": messenger_name,
                "messenger_creds": messenger_creds,
                "gemini_api_key": os.environ.get("GEMINI_API_KEY", ""),
                "conversation_history": conversation_history,
                "expires_at": timezone.now() + datetime.timedelta(hours=24),
            },
        )
    except Exception:
        pass

    # ── Call n8n webhook ──────────────────────────────────────────────────────
    webhook_url = _get_agent_webhook(agent.slug)
    if not webhook_url:
        return {
            "success": False,
            "error": f"No n8n webhook configured for agent '{agent.name}'.",
        }

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "X-Agent-Secret": os.environ.get("N8N_AGENT_SECRET", ""),
            },
            timeout=60,
        )
        response.raise_for_status()
        try:
            data = response.json()
        except ValueError:
            data = {"response": response.text}
        return {"success": True, "data": data}
    except requests.Timeout:
        return {"success": False, "error": "Agent request timed out."}
    except requests.HTTPError as e:
        return {"success": False, "error": f"Agent error: {e.response.text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _get_agent_webhook(slug: str) -> str:
    key = f"N8N_WEBHOOK_{slug.upper().replace('-', '_')}"
    return os.environ.get(key, "")


def refresh_credentials_if_needed():
    from apps.integrations.models import OrgIntegrationCredential
    from apps.integrations.oauth import refresh_access_token
    from django.utils import timezone
    import datetime
    threshold = timezone.now() + datetime.timedelta(minutes=10)
    expiring = OrgIntegrationCredential.objects.filter(
        is_active=True,
        token_expiry__lt=threshold,
        refresh_token__gt=""
    ).select_related("provider")
    for cred in expiring:
        try:
            refresh_access_token(cred)
        except Exception:
            pass
