from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsSuperAdmin
from apps.agents.execution import execute_agent
from apps.agents.models import Agent, AgentUsageLog, UserAgentAccess
from apps.agents.serializers import (
    AgentListSerializer,
    AgentSerializer,
    GrantAccessSerializer,
    MyAgentSerializer,
    UserAgentAccessSerializer,
)
from apps.core.pagination import StandardResultsSetPagination


# ── Shared helpers ────────────────────────────────────────────────────────────

def _success(data=None, message: str = "", status_code: int = status.HTTP_200_OK) -> Response:
    body: dict = {"success": True}
    if message:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return Response(body, status=status_code)


def _get_agent_or_404(slug: str) -> Agent:
    try:
        return Agent.objects.get(slug=slug)
    except Agent.DoesNotExist:
        raise NotFound("Agent not found.")


def _user_has_agent_access(user, agent) -> bool:
    """
    Returns True if the user is allowed to execute this agent.

    Access hierarchy:
      Superadmin    → always yes
      Admin (owner) → yes only if their org has an active OrgAgentAccess record
                      (either self-subscribed or superadmin-granted)
      Regular user  → yes if ANY of:
                        a) Direct UserAgentAccess (superadmin-granted)
                        b) AgentGroupMembership → AgentGroupAccess
                        c) UserAgentPermission granted by their org admin
                        d) Their org has an active OrgAgentAccess subscription
                           (all org members inherit access automatically)
    """
    from apps.accounts.models import CustomUser

    if user.role == CustomUser.Role.SUPERADMIN:
        return True

    if user.role == CustomUser.Role.ADMIN:
        from apps.organizations.models import OrgAgentAccess
        try:
            org = user.owned_organization
            return OrgAgentAccess.objects.filter(
                org=org, agent=agent, is_enabled=True
            ).exists()
        except Exception:
            return False

    now = timezone.now()

    # a) Direct UserAgentAccess (superadmin grants)
    if UserAgentAccess.objects.filter(
        user=user,
        agent=agent,
        is_active=True,
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).exists():
        return True

    # b) Group-based access — only valid if the group creator's org is still subscribed
    from apps.agents.group_models import AgentGroupMembership
    if AgentGroupMembership.objects.filter(
        user=user,
        is_active=True,
        group__is_active=True,
        group__agent_accesses__agent=agent,
        group__agent_accesses__is_active=True,
        # The org that owns this group must have an active subscription
        group__created_by__owned_organization__agent_accesses__agent=agent,
        group__created_by__owned_organization__agent_accesses__is_enabled=True,
    ).exists():
        return True

    # c) Org admin explicitly granted this user access (UserAgentPermission)
    try:
        from apps.organizations.models import UserAgentPermission
        if UserAgentPermission.objects.filter(
            user=user,
            agent=agent,
            is_active=True,
        ).exists():
            return True
    except Exception:
        pass

    # d) Org-level subscription — all members of a subscribed org get access
    try:
        from apps.organizations.models import OrgAgentAccess, OrgMembership
        org_id = OrgMembership.objects.filter(
            user=user, is_active=True
        ).values_list("org_id", flat=True).first()
        if org_id and OrgAgentAccess.objects.filter(
            org_id=org_id, agent=agent, is_enabled=True
        ).exists():
            return True
    except Exception:
        pass

    return False


def _log_action(user, agent, action: str, request: Request) -> None:
    """Fire-and-forget usage log. Does not raise on failure."""
    try:
        ip = (
            (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR")
        )
        AgentUsageLog.objects.create(user=user, agent=agent, action=action, ip_address=ip)
    except Exception:
        pass


# ── Public: browse agents (no auth required) ─────────────────────────────────

class PublicAgentListView(APIView):
    """
    GET /api/v1/agents/public/

    Anyone can browse active agents — no authentication needed.
    Config is never returned. The `has_access` field tells authenticated
    users whether they personally have access; for anonymous requests it
    is always False.

    Query params: agent_type, status, search (name/subtitle icontains)
    """
    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        qs = Agent.objects.all().order_by("name")

        agent_type = request.query_params.get("agent_type", "").strip()
        status_filter = request.query_params.get("status", "").strip()
        search = request.query_params.get("search", "").strip()

        if agent_type:
            qs = qs.filter(agent_type=agent_type)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(subtitle__icontains=search)
            )

        # Build access set — combines direct + group access for authenticated users
        access_ids = set()
        if request.user and request.user.is_authenticated:
            from apps.agents.group_models import AgentGroupMembership

            now = timezone.now()

            # 1. Direct individual access (active + not expired)
            direct_ids = set(
                UserAgentAccess.objects.filter(
                    user=request.user,
                    is_active=True,
                )
                .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
                .values_list("agent_id", flat=True)
            )

            # 2. Group-based access (user in active group → active agent assignment)
            group_ids = set(
                AgentGroupMembership.objects.filter(
                    user=request.user,
                    is_active=True,
                    group__is_active=True,
                )
                .filter(
                    group__agent_accesses__is_active=True,
                    group__agent_accesses__agent__is_active=True,
                )
                .values_list("group__agent_accesses__agent_id", flat=True)
            )

            access_ids = direct_ids | group_ids

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)

        data = []
        for agent in page:
            data.append({
                "id": str(agent.id),
                "name": agent.name,
                "subtitle": agent.subtitle,
                "description": agent.description,
                "slug": agent.slug,
                "agent_type": agent.agent_type,
                "status": agent.status,
                "latency": agent.latency,
                "efficiency": agent.efficiency,
                "is_active": agent.is_active,
                "has_access": agent.id in access_ids,
                "requires_auth": True,
            })

        return paginator.get_paginated_response(data)


# ── SuperAdmin: Agent CRUD ────────────────────────────────────────────────────

class AgentListCreateView(APIView):
    """
    GET  /api/v1/agents/
         SuperAdmin: all agents, filterable.
         Query params: agent_type, is_active (true/false), search (name icontains)

    POST /api/v1/agents/
         SuperAdmin: create a new agent.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request: Request) -> Response:
        qs = Agent.objects.all()

        agent_type = request.query_params.get("agent_type", "").strip()
        is_active = request.query_params.get("is_active")
        search = request.query_params.get("search", "").strip()

        if agent_type:
            qs = qs.filter(agent_type=agent_type)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        if search:
            qs = qs.filter(name__icontains=search)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AgentListSerializer(page, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = AgentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        agent = serializer.save()
        _log_action(request.user, agent, "create", request)
        return _success(
            data=AgentSerializer(agent).data,
            message="Agent created successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class AgentDetailView(APIView):
    """
    GET    /api/v1/agents/<slug>/   — retrieve full agent detail
    PUT    /api/v1/agents/<slug>/   — full update
    PATCH  /api/v1/agents/<slug>/   — partial update
    DELETE /api/v1/agents/<slug>/   — hard delete (cascades access records)
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request: Request, slug: str) -> Response:
        agent = _get_agent_or_404(slug)
        return _success(data=AgentSerializer(agent).data)

    def put(self, request: Request, slug: str) -> Response:
        agent = _get_agent_or_404(slug)
        serializer = AgentSerializer(agent, data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        _log_action(request.user, updated, "update", request)
        return _success(
            data=AgentSerializer(updated).data,
            message="Agent updated successfully.",
        )

    def patch(self, request: Request, slug: str) -> Response:
        agent = _get_agent_or_404(slug)
        serializer = AgentSerializer(agent, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        _log_action(request.user, updated, "partial_update", request)
        return _success(
            data=AgentSerializer(updated).data,
            message="Agent updated successfully.",
        )

    def delete(self, request: Request, slug: str) -> Response:
        agent = _get_agent_or_404(slug)
        agent_name = agent.name
        # Log before delete so the FK is still valid
        _log_action(request.user, agent, "delete", request)
        agent.delete()
        return _success(message=f"Agent '{agent_name}' deleted successfully.")


class AgentToggleStatusView(APIView):
    """
    POST /api/v1/agents/<slug>/toggle-status/

    Flips is_active between True and False atomically.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def post(self, request: Request, slug: str) -> Response:
        agent = _get_agent_or_404(slug)
        agent.is_active = not agent.is_active
        agent.save(update_fields=["is_active", "updated_at"])
        state = "activated" if agent.is_active else "deactivated"
        _log_action(request.user, agent, f"toggle_status_{state}", request)
        return _success(
            data={
                "id": str(agent.id),
                "slug": agent.slug,
                "name": agent.name,
                "is_active": agent.is_active,
            },
            message=f"Agent '{agent.name}' has been {state}.",
        )


# ── SuperAdmin: Access management ─────────────────────────────────────────────

class AgentAccessView(APIView):
    """
    GET  /api/v1/agents/<slug>/access/
         List all UserAgentAccess records for an agent.
         Query params: is_active (true/false)

    POST /api/v1/agents/<slug>/access/
         Grant (or update existing) access for a user.
         Body: { "user_id": "<uuid>", "expires_at": "<ISO datetime>" (optional) }
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request: Request, slug: str) -> Response:
        agent = _get_agent_or_404(slug)
        qs = (
            UserAgentAccess.objects
            .filter(agent=agent)
            .select_related("user", "granted_by")
            .order_by("-created_at")
        )

        is_active = request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            UserAgentAccessSerializer(page, many=True).data
        )

    def post(self, request: Request, slug: str) -> Response:
        agent = _get_agent_or_404(slug)
        serializer = GrantAccessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        access, created = serializer.save(agent=agent, granted_by=request.user)

        _log_action(
            request.user,
            agent,
            "grant_access" if created else "update_access",
            request,
        )

        http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        action_word = "granted" if created else "updated"
        return _success(
            data=UserAgentAccessSerializer(access).data,
            message=f"Access {action_word} successfully.",
            status_code=http_status,
        )


class AgentAccessRevokeView(APIView):
    """
    DELETE /api/v1/agents/<slug>/access/<uuid:user_id>/

    Soft-revokes a user's access by setting is_active=False.
    The record is preserved for audit purposes.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def delete(self, request: Request, slug: str, user_id) -> Response:
        agent = _get_agent_or_404(slug)
        try:
            access = UserAgentAccess.objects.select_related("user").get(
                agent=agent, user__id=user_id
            )
        except UserAgentAccess.DoesNotExist:
            raise NotFound("Access record not found.")

        if not access.is_active:
            return _success(
                message=f"Access for {access.user.email} is already revoked."
            )

        access.is_active = False
        access.save(update_fields=["is_active", "updated_at"])
        _log_action(request.user, agent, "revoke_access", request)
        return _success(
            message=f"Access for {access.user.email} has been revoked."
        )


# ── User: my agents ───────────────────────────────────────────────────────────

class AgentExecuteView(APIView):
    """
    POST /api/v1/agents/<slug>/execute/

    User sends a message to an agent.
    Backend resolves credentials and forwards to n8n webhook.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, slug: str) -> Response:
        agent = _get_agent_or_404(slug)

        if not agent.is_active:
            return Response(
                {"success": False, "error": "This agent is currently unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not _user_has_agent_access(request.user, agent):
            raise PermissionDenied("You do not have access to this agent.")

        message = request.data.get("message", "").strip()
        if not message:
            return Response(
                {"success": False, "error": "message is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build extra from well-known optional fields + any additional keys
        extra: dict = {}
        if request.data.get("sessionId"):
            extra["sessionId"] = request.data["sessionId"]
        if request.data.get("channel"):
            extra["channel"] = request.data["channel"]
        if isinstance(request.data.get("conversationHistory"), list):
            extra["conversationHistory"] = request.data["conversationHistory"]
        # Allow arbitrary pass-through via "extra" key (backwards compat)
        legacy_extra = request.data.get("extra", {})
        if isinstance(legacy_extra, dict):
            extra.update({k: v for k, v in legacy_extra.items() if k not in extra})

        result = execute_agent(
            user=request.user,
            agent=agent,
            message=message,
            extra=extra,
        )

        _log_action(request.user, agent, "execute", request)

        if not result["success"]:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        _data = result.get("data")
        if isinstance(_data, dict):
            raw = _data
        elif isinstance(_data, list) and _data:
            raw = _data[0]
        else:
            raw = {}

        frontend_data = {
            "reply": raw.get("reply", ""),
            "session_id": raw.get("session_id", ""),
            "intent": raw.get("intent"),
            "log_id": raw.get("log_id"),
            "timestamp": raw.get("timestamp"),
        }
        return _success(data=frontend_data, message="Agent response received.")


class AgentVoiceView(APIView):
    """
    POST /api/v1/agents/<slug>/voice/

    Accepts an audio file, transcribes via ElevenLabs STT, runs the agent,
    converts reply to speech via ElevenLabs TTS, and returns both text + audio URL.

    Multipart form fields:
      - audio      (file, required)  — recorded audio (webm, mp4, wav, mp3, etc.)
      - sessionId  (str, optional)
      - channel    (str, optional, defaults to "voice")
    """
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, slug: str) -> Response:
        from apps.agents.elevenlabs import speech_to_text, text_to_speech
        from django.conf import settings as django_settings
        import os

        agent = _get_agent_or_404(slug)

        if not agent.is_active:
            return Response(
                {"success": False, "error": "This agent is currently unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not _user_has_agent_access(request.user, agent):
            raise PermissionDenied("You do not have access to this agent.")

        audio_file = request.FILES.get("audio")
        if not audio_file:
            return Response(
                {"success": False, "error": "audio file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 1: Speech → Text
        try:
            transcript = speech_to_text(audio_file)
        except Exception as e:
            return Response(
                {"success": False, "error": f"Speech-to-text failed: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not transcript:
            return Response(
                {"success": False, "error": "Could not transcribe audio. Please try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 2: Run agent with transcript (same as text execute)
        extra: dict = {"channel": request.data.get("channel", "voice")}
        if request.data.get("sessionId"):
            extra["sessionId"] = request.data["sessionId"]

        result = execute_agent(
            user=request.user,
            agent=agent,
            message=transcript,
            extra=extra,
        )

        _log_action(request.user, agent, "voice_execute", request)

        if not result["success"]:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        _data = result.get("data")
        if isinstance(_data, dict):
            raw = _data
        elif isinstance(_data, list) and _data:
            raw = _data[0]
        else:
            raw = {}
        reply_text = raw.get("reply", "")

        # Step 3: Text → Speech
        audio_url = None
        if reply_text:
            try:
                media_path = text_to_speech(reply_text)
                backend_url = os.environ.get("BACKEND_URL", "").rstrip("/")
                audio_url = f"{backend_url}/media/{media_path}"
            except Exception:
                pass  # Degrade gracefully — return text even if TTS fails

        frontend_data = {
            "reply": reply_text,
            "audio_url": audio_url,
            "transcript": transcript,
            "session_id": raw.get("session_id", ""),
            "intent": raw.get("intent"),
            "log_id": raw.get("log_id"),
            "timestamp": raw.get("timestamp"),
        }
        return _success(data=frontend_data, message="Voice response received.")


class MyAgentsView(APIView):
    """
    GET /api/v1/agents/my-agents/

    Returns all active agents the authenticated user can access via:
      1. Direct individual access (UserAgentAccess)
      2. Group membership (AgentGroupMembership → AgentGroupAccess)

    Deduplicates — if an agent appears in both, it shows once.
    Config is never returned.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        from apps.agents.group_models import AgentGroupMembership

        now = timezone.now()

        # ── 1. Direct individual access ───────────────────────────────────────
        direct_qs = (
            UserAgentAccess.objects
            .filter(
                user=request.user,
                is_active=True,
                agent__is_active=True,
            )
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .select_related("agent")
        )

        direct_agent_ids = set()
        agents_data = []

        for access in direct_qs:
            agent = access.agent
            direct_agent_ids.add(agent.id)
            agents_data.append({
                "agent_id": str(agent.id),
                "name": agent.name,
                "subtitle": agent.subtitle,
                "description": agent.description,
                "slug": agent.slug,
                "agent_type": agent.agent_type,
                "status": agent.status,
                "latency": agent.latency,
                "efficiency": agent.efficiency,
                "agent_is_active": agent.is_active,
                "access_via": "direct",
                "expires_at": access.expires_at,
            })

        # ── 2. Group-based access ─────────────────────────────────────────────
        memberships = (
            AgentGroupMembership.objects
            .filter(
                user=request.user,
                is_active=True,
                group__is_active=True,
            )
            .prefetch_related("group__agent_accesses__agent")
        )

        for membership in memberships:
            for group_access in membership.group.agent_accesses.filter(
                is_active=True, agent__is_active=True
            ):
                agent = group_access.agent
                if agent.id in direct_agent_ids:
                    # Already present via direct access — skip duplicate
                    continue
                direct_agent_ids.add(agent.id)
                agents_data.append({
                    "agent_id": str(agent.id),
                    "name": agent.name,
                    "subtitle": agent.subtitle,
                    "description": agent.description,
                    "slug": agent.slug,
                    "agent_type": agent.agent_type,
                    "status": agent.status,
                    "latency": agent.latency,
                    "efficiency": agent.efficiency,
                    "agent_is_active": agent.is_active,
                    "access_via": "group",
                    "group_name": membership.group.name,
                    "expires_at": None,
                })

        # Sort combined list alphabetically
        agents_data.sort(key=lambda x: x["name"].lower())

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(agents_data, request)
        return paginator.get_paginated_response(page)
