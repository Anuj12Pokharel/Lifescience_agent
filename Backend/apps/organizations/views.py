import os

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsSuperAdmin, IsAdminOrSuperAdmin
from apps.organizations.models import AgentSession, OrgAgentAccess, OrgAgentConfig, Organization, Reminder, UserAgentPermission
from apps.organizations.permissions import IsOrgOwner
from apps.organizations.serializers import (
    GrantUserAgentPermissionSerializer,
    OrgAgentAccessSerializer,
    OrgAgentToggleSerializer,
    OrgMemberSerializer,
    OrganizationSerializer,
    OrganizationUpdateSerializer,
    UserAgentPermissionSerializer,
)
from apps.core.pagination import StandardResultsSetPagination


def _ok(data=None, message="", status_code=status.HTTP_200_OK):
    body = {"success": True}
    if message:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return Response(body, status=status_code)


# ── Admin: my organization ─────────────────────────────────────────────────────

class MyOrganizationView(APIView):
    """Admin gets/updates their own organization."""
    permission_classes = [IsOrgOwner]

    def get(self, request):
        org = request.user.owned_organization
        return _ok(OrganizationSerializer(org).data)

    def patch(self, request):
        org = request.user.owned_organization
        s = OrganizationUpdateSerializer(org, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return _ok(OrganizationSerializer(org).data, message="Organization updated.")


# ── Superadmin: all organizations ─────────────────────────────────────────────

class OrganizationListView(APIView):
    """Superadmin lists all organizations."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = Organization.objects.select_related("owner", "plan").all()
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(OrganizationSerializer(page, many=True).data)


class OrganizationDetailView(APIView):
    """Superadmin views/deactivates a specific org."""
    permission_classes = [IsSuperAdmin]

    def _get_org(self, pk):
        try:
            return Organization.objects.select_related("owner", "plan").get(pk=pk)
        except Organization.DoesNotExist:
            return None

    def get(self, request, pk):
        org = self._get_org(pk)
        if not org:
            return Response({"detail": "Not found."}, status=404)
        return _ok(OrganizationSerializer(org).data)

    def patch(self, request, pk):
        """Superadmin can activate/deactivate an org."""
        org = self._get_org(pk)
        if not org:
            return Response({"detail": "Not found."}, status=404)
        is_active = request.data.get("is_active")
        if is_active is not None:
            org.is_active = bool(is_active)
            org.save(update_fields=["is_active"])
        return _ok(OrganizationSerializer(org).data, message="Organization updated.")


# ── Superadmin: toggle agent access for an org ────────────────────────────────

class OrgAgentAccessListView(APIView):
    """Superadmin sees all agents and their enabled/disabled state for an org."""
    permission_classes = [IsSuperAdmin]

    def get(self, request, org_pk):
        try:
            org = Organization.objects.get(pk=org_pk)
        except Organization.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        accesses = OrgAgentAccess.objects.filter(org=org).select_related("agent", "disabled_by")
        return _ok(OrgAgentAccessSerializer(accesses, many=True).data)


class OrgAgentToggleView(APIView):
    """Superadmin enables or disables a specific agent for an org."""
    permission_classes = [IsSuperAdmin]

    def post(self, request, org_pk, agent_pk):
        from apps.agents.models import Agent
        try:
            org = Organization.objects.get(pk=org_pk)
            agent = Agent.objects.get(pk=agent_pk)
        except (Organization.DoesNotExist, Agent.DoesNotExist):
            return Response({"detail": "Not found."}, status=404)

        s = OrgAgentToggleSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        access = s.save(org=org, agent=agent, disabled_by=request.user)
        verb = "enabled" if access.is_enabled else "disabled"
        return _ok(
            OrgAgentAccessSerializer(access).data,
            message=f"Agent {verb} for {org.name}.",
        )


# ── Admin: members of my org ──────────────────────────────────────────────────

class OrgMemberListView(APIView):
    """Admin sees members of their org."""
    permission_classes = [IsOrgOwner]

    def get(self, request):
        org = request.user.owned_organization
        members = org.memberships.select_related("user").all()
        return _ok(OrgMemberSerializer(members, many=True).data)


# ── Admin: grant/revoke user-agent permissions ────────────────────────────────

class UserAgentPermissionListView(APIView):
    """Admin sees all user-agent permissions in their org."""
    permission_classes = [IsOrgOwner]

    def get(self, request):
        org = request.user.owned_organization
        perms = org.user_agent_permissions.select_related("user", "agent").all()
        return _ok(UserAgentPermissionSerializer(perms, many=True).data)

    def post(self, request):
        """Grant a user access to an agent."""
        s = GrantUserAgentPermissionSerializer(
            data=request.data, context={"request": request}
        )
        s.is_valid(raise_exception=True)
        perm = s.save()
        return _ok(
            UserAgentPermissionSerializer(perm).data,
            message="Agent access granted.",
            status_code=status.HTTP_201_CREATED,
        )


class UserAgentPermissionDetailView(APIView):
    """Admin revokes a user-agent permission."""
    permission_classes = [IsOrgOwner]

    def delete(self, request, pk):
        org = request.user.owned_organization
        try:
            perm = org.user_agent_permissions.get(pk=pk)
        except UserAgentPermission.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        perm.is_active = False
        perm.save(update_fields=["is_active"])
        return _ok(message="Agent access revoked.")


# ── Admin: full agent catalog with org context ────────────────────────────────

class AdminAgentCatalogView(APIView):
    """
    GET /api/v1/organizations/me/agents/

    Admin sees ALL active agents in the platform.
    Each agent shows:
      - is_blocked_by_superadmin  → superadmin disabled this agent for this org
      - integration_connected     → org has credentials saved for this agent
      - users_with_access         → how many org members can use this agent
    """
    permission_classes = [IsOrgOwner]

    def get(self, request):
        from apps.agents.models import Agent
        from apps.integrations.models import OrgIntegrationCredential

        org = request.user.owned_organization

        agents = Agent.objects.filter(is_active=True).order_by("name")

        # Fetch org-level disable records (absence = enabled)
        disabled_agent_ids = set(
            OrgAgentAccess.objects.filter(
                org=org, is_enabled=False
            ).values_list("agent_id", flat=True)
        )

        # Fetch which agents have integration credentials connected
        connected_agent_ids = set(
            OrgIntegrationCredential.objects.filter(
                org=org, is_active=True
            ).values_list("provider__agent_id", flat=True)
        )

        # Fetch per-agent user count
        from apps.organizations.models import UserAgentPermission as UAP
        user_counts = {}
        for perm in UAP.objects.filter(org=org, is_active=True).values("agent_id"):
            agent_id = perm["agent_id"]
            user_counts[agent_id] = user_counts.get(agent_id, 0) + 1

        results = []
        for agent in agents:
            results.append({
                "id": str(agent.id),
                "name": agent.name,
                "subtitle": agent.subtitle,
                "description": agent.description,
                "slug": agent.slug,
                "agent_type": agent.agent_type,
                "status": agent.status,
                "latency": agent.latency,
                "efficiency": agent.efficiency,
                "is_blocked_by_superadmin": agent.id in disabled_agent_ids,
                "integration_connected": agent.id in connected_agent_ids,
                "users_with_access": user_counts.get(agent.id, 0),
            })

        return _ok(results)


# ── Internal: n8n → Django callback ──────────────────────────────────────────

class InternalCompanyUpsertView(APIView):
    """
    POST /api/v1/internal/companies/upsert

    Called by n8n after session setup to store company agent config.
    Authenticated via x-internal-token header (shared secret).

    Body (all fields optional except company_id + agent_slug):
    {
      "company_id": "<org-uuid>",
      "agent_slug": "project-tracking-agent",
      "tracker": "jira",
      "available_projects": [...],
      "last_project_key": "PROJ",
      "last_project_name": "My Project",
      "projects_fetched_at": "2026-01-01T00:00:00Z",
      "projects_stale": false,
      "messenger": "slack",
      "default_channel": "#general",
      "extra": {}
    }
    """
    permission_classes = [AllowAny]

    def _authenticate(self, request):
        token = request.headers.get("x-internal-token", "")
        expected = os.environ.get("BACKEND_INTERNAL_TOKEN", "")
        if not expected or token != expected:
            return False
        return True

    def post(self, request):
        if not self._authenticate(request):
            return Response({"detail": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        company_id = request.data.get("company_id", "").strip()

        if not company_id:
            return Response(
                {"detail": "company_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            org = Organization.objects.get(pk=company_id)
        except Organization.DoesNotExist:
            return Response({"detail": "Organization not found."}, status=status.HTTP_404_NOT_FOUND)

        # agent_slug is optional — if provided link to agent, else store at org level
        agent_slug = request.data.get("agent_slug", "").strip()
        agent = None
        if agent_slug:
            try:
                from apps.agents.models import Agent
                agent = Agent.objects.get(slug=agent_slug)
            except Agent.DoesNotExist:
                pass

        if agent:
            config, _ = OrgAgentConfig.objects.get_or_create(org=org, agent=agent)
        else:
            # Use first agent linked to org's credentials as fallback
            from apps.integrations.models import OrgIntegrationCredential
            cred = OrgIntegrationCredential.objects.filter(org=org, is_active=True).select_related("provider__agent").first()
            if cred:
                config, _ = OrgAgentConfig.objects.get_or_create(org=org, agent=cred.provider.agent)
            else:
                return Response({"detail": "No agent found for this org."}, status=status.HTTP_404_NOT_FOUND)

        if "tracker" in request.data:
            config.tracker = request.data["tracker"] or ""
        if "tracker_creds" in request.data and isinstance(request.data["tracker_creds"], dict):
            config.tracker_creds = request.data["tracker_creds"]
        if "available_projects" in request.data:
            config.available_projects = request.data["available_projects"] or []
        if "last_project_key" in request.data:
            config.last_project_key = request.data["last_project_key"]
        if "last_project_name" in request.data:
            config.last_project_name = request.data["last_project_name"]
        if "projects_fetched_at" in request.data:
            config.projects_fetched_at = request.data["projects_fetched_at"]
        if "projects_stale" in request.data:
            config.projects_stale = bool(request.data["projects_stale"])
        if "messenger" in request.data:
            config.messenger = request.data["messenger"] or ""
        if "messenger_creds" in request.data and isinstance(request.data["messenger_creds"], dict):
            config.messenger_creds = request.data["messenger_creds"]
        if "default_channel" in request.data:
            config.default_channel = request.data["default_channel"]
        if "extra" in request.data and isinstance(request.data["extra"], dict):
            config.extra = request.data["extra"]
        if "gemini_api_key" in request.data:
            config.extra = {**config.extra, "gemini_api_key": request.data["gemini_api_key"]}

        config.save()

        return _ok(
            data={
                "company_id": str(org.id),
                "tracker": config.tracker,
                "available_projects": config.available_projects,
                "last_project_key": config.last_project_key,
                "projects_stale": config.projects_stale,
                "messenger": config.messenger,
                "default_channel": config.default_channel,
            },
            message="Company config updated.",
        )


class InternalSessionView(APIView):
    """
    GET  /internal/sessions/<session_id>  — n8n loads session
    POST /internal/sessions/              — n8n saves/upserts session
    """
    permission_classes = [AllowAny]

    def _authenticate(self, request):
        token = request.headers.get("x-internal-token", "")
        expected = os.environ.get("BACKEND_INTERNAL_TOKEN", "")
        return bool(expected and token == expected)

    def get(self, request, session_id):
        if not self._authenticate(request):
            return Response({"detail": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            session = AgentSession.objects.select_related("org").get(session_id=session_id)
        except AgentSession.DoesNotExist:
            return Response({"detail": "Session not found."}, status=status.HTTP_404_NOT_FOUND)

        # Use stored creds if present; fall back to rebuilding from OrgIntegrationCredential
        tracker_creds = session.tracker_creds or {}
        messenger_creds = session.messenger_creds or {}
        if (not tracker_creds or not messenger_creds) and session.org and session.agent_slug:
            try:
                from apps.agents.models import Agent
                from apps.integrations.models import OrgIntegrationCredential
                from apps.agents.execution import _TRACKER_PROVIDERS, _MESSENGER_PROVIDERS, _build_tracker_creds, _build_messenger_creds
                agent = Agent.objects.get(slug=session.agent_slug)
                credentials = OrgIntegrationCredential.objects.filter(
                    org=session.org, provider__agent=agent, is_active=True
                ).select_related("provider")
                for cred in credentials:
                    slug = cred.provider.provider.lower()
                    if slug in _TRACKER_PROVIDERS and not tracker_creds:
                        tracker_creds = _build_tracker_creds(cred)
                    elif slug in _MESSENGER_PROVIDERS and not messenger_creds:
                        messenger_creds = _build_messenger_creds(cred)
            except Exception:
                pass

        return _ok(data={
            "session_id": session.session_id,
            "company_id": str(session.org.id) if session.org else "",
            "user_id": session.user_id,
            "user_name": session.user_name,
            "user_email": session.user_email,
            "gemini_api_key": session.gemini_api_key,
            "expires_at": session.expires_at.isoformat() if session.expires_at else None,
            "tracker": session.tracker,
            "tracker_creds": tracker_creds,
            "messenger": session.messenger,
            "messenger_creds": messenger_creds,
            "default_channel": session.default_channel,
            "available_projects": session.available_projects,
            "last_project_key": session.last_project_key,
            "last_project_name": session.last_project_name,
            "projects_fetched_at": session.projects_fetched_at,
            "conversation_history": session.conversation_history,
        })

    def post(self, request, session_id=None):
        if not self._authenticate(request):
            return Response({"detail": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        # Accept session_id from URL path or request body
        session_id = session_id or request.data.get("session_id", "")
        session_id = session_id.strip() if session_id else ""
        if not session_id:
            return Response({"detail": "session_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        company_id = request.data.get("company_id", "").strip()
        org = None
        if company_id:
            try:
                org = Organization.objects.get(pk=company_id)
            except Organization.DoesNotExist:
                pass

        session, _ = AgentSession.objects.get_or_create(session_id=session_id)

        if org:
            session.org = org
        if request.data.get("agent_slug"):
            session.agent_slug = request.data["agent_slug"]
        if request.data.get("user_id"):
            session.user_id = request.data["user_id"]
        if "tracker" in request.data:
            session.tracker = request.data["tracker"] or ""
        if "tracker_creds" in request.data and isinstance(request.data["tracker_creds"], dict):
            session.tracker_creds = request.data["tracker_creds"]
        if "messenger" in request.data:
            session.messenger = request.data["messenger"] or ""
        if "messenger_creds" in request.data and isinstance(request.data["messenger_creds"], dict):
            session.messenger_creds = request.data["messenger_creds"]
        if "default_channel" in request.data:
            session.default_channel = request.data["default_channel"]
        if "available_projects" in request.data:
            session.available_projects = request.data["available_projects"] or []
        if "last_project_key" in request.data:
            session.last_project_key = request.data["last_project_key"]
        if "last_project_name" in request.data:
            session.last_project_name = request.data["last_project_name"]
        if "projects_fetched_at" in request.data:
            session.projects_fetched_at = request.data["projects_fetched_at"]
        if "conversation_history" in request.data:
            session.conversation_history = request.data["conversation_history"] or []
        if "user_name" in request.data:
            session.user_name = request.data["user_name"] or ""
        if "user_email" in request.data:
            session.user_email = request.data["user_email"] or ""
        if "gemini_api_key" in request.data:
            session.gemini_api_key = request.data["gemini_api_key"] or ""
        if "expires_at" in request.data:
            session.expires_at = request.data["expires_at"]

        session.save()
        return _ok(data={"session_id": session.session_id}, message="Session saved.")


class InternalLogView(APIView):
    """
    POST /internal/logs
    Called by n8n to record an agent action (ticket created, status updated, etc.)
    Authenticated via x-internal-token header.
    Body: { session_id, company_id, user_id, agent_slug, action_type, details }
    """
    permission_classes = [AllowAny]

    def _authenticate(self, request):
        token = request.headers.get("x-internal-token", "")
        expected = os.environ.get("BACKEND_INTERNAL_TOKEN", "")
        return bool(expected and token == expected)

    def post(self, request):
        if not self._authenticate(request):
            return Response({"detail": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        # Just acknowledge — extend with a model later if needed
        import logging
        logger = logging.getLogger("agent.actions")
        logger.info(
            "Agent action: %s | session=%s | company=%s | user=%s | details=%s",
            request.data.get("action_type", "unknown"),
            request.data.get("session_id", ""),
            request.data.get("company_id", ""),
            request.data.get("user_id", ""),
            request.data.get("details", {}),
        )
        return _ok(message="Log recorded.")


class InternalCompaniesAllView(APIView):
    """
    GET /internal/companies/all

    Returns all active orgs that have both a tracker and messenger configured.
    Used by n8n scheduled jobs (daily/weekly digests, reminders, etc.).
    Authenticated via x-internal-token header.

    Response:
    {
      "success": true,
      "data": [
        {
          "company_id": "<org-uuid>",
          "company_name": "Acme Inc",
          "agent_slug": "project-tracking-agent",
          "tracker": "jira",
          "tracker_creds": { ... },
          "messenger": "slack",
          "messenger_creds": { ... },
          "default_channel": "#general",
          "available_projects": [...],
          "last_project_key": "PROJ"
        },
        ...
      ]
    }
    """
    permission_classes = [AllowAny]

    def _authenticate(self, request):
        token = request.headers.get("x-internal-token", "")
        expected = os.environ.get("BACKEND_INTERNAL_TOKEN", "")
        return bool(expected and token == expected)

    def get(self, request):
        if not self._authenticate(request):
            return Response({"detail": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        from apps.agents.models import Agent
        from apps.integrations.models import OrgIntegrationCredential
        from apps.agents.execution import _TRACKER_PROVIDERS, _MESSENGER_PROVIDERS, _build_tracker_creds, _build_messenger_creds

        results = []

        # Walk all active OrgAgentConfigs that have both tracker and messenger set
        configs = OrgAgentConfig.objects.select_related("org", "agent").filter(
            org__is_active=True,
            tracker__gt="",
            messenger__gt="",
        )

        for config in configs:
            org = config.org
            agent = config.agent

            # Use stored creds if present; fall back to rebuilding from OrgIntegrationCredential
            tracker_creds = config.tracker_creds or {}
            messenger_creds = config.messenger_creds or {}
            if not tracker_creds or not messenger_creds:
                credentials = OrgIntegrationCredential.objects.filter(
                    org=org, provider__agent=agent, is_active=True
                ).select_related("provider")
                for cred in credentials:
                    slug = cred.provider.provider.lower()
                    if slug in _TRACKER_PROVIDERS and not tracker_creds:
                        tracker_creds = _build_tracker_creds(cred)
                    elif slug in _MESSENGER_PROVIDERS and not messenger_creds:
                        messenger_creds = _build_messenger_creds(cred)

            # Only include if we actually have usable credentials for both
            if not tracker_creds or not messenger_creds:
                continue

            results.append({
                "company_id": str(org.id),
                "company_name": org.name,
                "agent_slug": agent.slug,
                "tracker": config.tracker,
                "tracker_creds": tracker_creds,
                "messenger": config.messenger,
                "messenger_creds": messenger_creds,
                "default_channel": config.default_channel or "",
                "gemini_api_key": config.extra.get("gemini_api_key", "") if config.extra else "",
                "available_projects": config.available_projects,
                "last_project_key": config.last_project_key or "",
                "last_project_name": config.last_project_name or "",
                "projects_fetched_at": config.projects_fetched_at.isoformat() if config.projects_fetched_at else None,
                "projects_stale": config.projects_stale,
            })

        return _ok(data=results)


class InternalReminderView(APIView):
    """
    POST /internal/reminders/          — n8n creates a reminder
    GET  /internal/reminders/due/      — n8n polls for due reminders (to send)
    POST /internal/reminders/<id>/sent/ — n8n marks reminder as sent
    GET  /internal/reminders/?company_id=&user_id= — list reminders for a user
    """
    permission_classes = [AllowAny]

    def _authenticate(self, request):
        token = request.headers.get("x-internal-token", "")
        expected = os.environ.get("BACKEND_INTERNAL_TOKEN", "")
        return bool(expected and token == expected)

    def post(self, request, reminder_id=None):
        if not self._authenticate(request):
            return Response({"detail": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        # Mark as sent
        if reminder_id:
            try:
                reminder = Reminder.objects.get(id=reminder_id)
            except Reminder.DoesNotExist:
                return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
            reminder.is_sent = True
            reminder.sent_at = timezone.now()
            reminder.save(update_fields=["is_sent", "sent_at"])
            return _ok(message="Reminder marked as sent.")

        # Create reminder
        company_id = request.data.get("company_id", "").strip()
        user_id = request.data.get("user_id", "").strip()
        message = request.data.get("message", "").strip()
        remind_at = request.data.get("remind_at")

        if not message or not remind_at:
            return Response(
                {"detail": "message and remind_at are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org = None
        if company_id:
            try:
                org = Organization.objects.get(pk=company_id)
            except Organization.DoesNotExist:
                pass

        reminder = Reminder.objects.create(
            org=org,
            company_id=company_id,
            user_id=user_id,
            user_name=request.data.get("user_name", ""),
            user_email=request.data.get("user_email", ""),
            session_id=request.data.get("session_id", ""),
            message=message,
            remind_at=remind_at,
        )

        return _ok(
            data={"id": str(reminder.id), "remind_at": str(reminder.remind_at)},
            message="Reminder created.",
            status_code=status.HTTP_201_CREATED,
        )

    def get(self, request, reminder_id=None):
        if not self._authenticate(request):
            return Response({"detail": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

        # Due reminders — for n8n scheduler
        if request.path.endswith("/due/") or request.query_params.get("due"):
            now = timezone.now()
            due = Reminder.objects.filter(is_sent=False, remind_at__lte=now).order_by("remind_at")
            return _ok(data=[{
                "id": str(r.id),
                "company_id": r.company_id,
                "user_id": r.user_id,
                "user_name": r.user_name,
                "user_email": r.user_email,
                "session_id": r.session_id,
                "message": r.message,
                "remind_at": r.remind_at.isoformat(),
            } for r in due])

        # List reminders for a user
        company_id = request.query_params.get("company_id", "")
        user_id = request.query_params.get("user_id", "")
        qs = Reminder.objects.filter(is_sent=False)
        if company_id:
            qs = qs.filter(company_id=company_id)
        if user_id:
            qs = qs.filter(user_id=user_id)

        return _ok(data=[{
            "id": str(r.id),
            "message": r.message,
            "remind_at": r.remind_at.isoformat(),
            "created_at": r.created_at.isoformat(),
        } for r in qs.order_by("remind_at")])
