from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CustomUser
from apps.accounts.permissions import IsAdminOrSuperAdmin, IsSuperAdmin
from apps.agents.models import Agent, AgentTimeLimit, UsageSession


def _success(data=None, status_code=status.HTTP_200_OK):
    body = {"success": True}
    if data is not None:
        body["data"] = data
    return Response(body, status=status_code)


def _error(message, status_code=status.HTTP_400_BAD_REQUEST):
    return Response({"success": False, "error": {"message": message}}, status=status_code)


def _get_user_total_seconds(user, agent):
    """Sum all finished + active sessions for user+agent."""
    return UsageSession.objects.filter(
        user=user, agent=agent
    ).aggregate(total=Sum("seconds_active"))["total"] or 0


def _check_limit_exceeded(user, agent):
    """Returns (limit_minutes, used_minutes, is_exceeded) for a user on an agent."""
    try:
        limit = AgentTimeLimit.objects.get(agent=agent, target_user=user)
    except AgentTimeLimit.DoesNotExist:
        # Also check if the user's admin has a limit
        if user.managed_by:
            try:
                limit = AgentTimeLimit.objects.get(agent=agent, target_user=user.managed_by)
            except AgentTimeLimit.DoesNotExist:
                return None, 0, False
        else:
            return None, 0, False

    used_seconds = _get_user_total_seconds(user, agent)
    used_minutes = used_seconds / 60
    return limit.limit_minutes, used_minutes, used_minutes >= limit.limit_minutes


# ── Session: Start ─────────────────────────────────────────────────────────────

class UsageSessionStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        agent_slug = request.data.get("agent_slug")
        if not agent_slug:
            return _error("agent_slug is required")

        try:
            agent = Agent.objects.get(slug=agent_slug, is_active=True)
        except Agent.DoesNotExist:
            return _error("Agent not found", status.HTTP_404_NOT_FOUND)

        # Check time limit
        limit_min, used_min, exceeded = _check_limit_exceeded(request.user, agent)
        if exceeded:
            return _error(
                f"Time limit reached. You have used {round(used_min, 1)} of {limit_min} minutes for {agent.name}.",
                status.HTTP_403_FORBIDDEN,
            )

        # Close any stale open sessions for this user+agent
        UsageSession.objects.filter(
            user=request.user, agent=agent, is_active=True
        ).update(is_active=False, ended_at=timezone.now())

        session = UsageSession.objects.create(user=request.user, agent=agent)

        return _success({
            "session_id": str(session.id),
            "limit_minutes": limit_min,
            "used_minutes": round(used_min, 1),
        }, status.HTTP_201_CREATED)


# ── Session: Heartbeat (tab active, accumulate seconds) ───────────────────────

class UsageSessionHeartbeatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = UsageSession.objects.get(
                id=session_id, user=request.user, is_active=True
            )
        except UsageSession.DoesNotExist:
            return _error("Session not found", status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        delta_seconds = int((now - session.last_heartbeat).total_seconds())
        # Clamp: ignore gaps > 35s (tab was hidden, heartbeat missed)
        delta_seconds = min(delta_seconds, 35)
        session.seconds_active += delta_seconds
        session.last_heartbeat = now
        session.save(update_fields=["seconds_active", "last_heartbeat"])

        # Check if limit now exceeded
        limit_min, used_min, exceeded = _check_limit_exceeded(
            request.user, session.agent
        )

        return _success({
            "seconds_active": session.seconds_active,
            "minutes_active": session.minutes_active,
            "limit_exceeded": exceeded,
            "limit_minutes": limit_min,
        })


# ── Session: End ──────────────────────────────────────────────────────────────

class UsageSessionEndView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = UsageSession.objects.get(
                id=session_id, user=request.user, is_active=True
            )
        except UsageSession.DoesNotExist:
            return _error("Session not found", status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        delta_seconds = int((now - session.last_heartbeat).total_seconds())
        delta_seconds = min(delta_seconds, 35)
        session.seconds_active += delta_seconds
        session.ended_at = now
        session.is_active = False
        session.save(update_fields=["seconds_active", "ended_at", "is_active"])

        return _success({"minutes_active": session.minutes_active})


# ── User: my usage stats ──────────────────────────────────────────────────────

class MyUsageStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = UsageSession.objects.filter(user=request.user).values(
            "agent__id", "agent__name", "agent__slug"
        ).annotate(total_seconds=Sum("seconds_active"))

        result = []
        for s in sessions:
            agent_id = str(s["agent__id"])
            limit_min = None
            try:
                limit = AgentTimeLimit.objects.get(
                    agent_id=s["agent__id"], target_user=request.user
                )
                limit_min = limit.limit_minutes
            except AgentTimeLimit.DoesNotExist:
                pass

            result.append({
                "agent_id": agent_id,
                "agent_name": s["agent__name"],
                "agent_slug": s["agent__slug"],
                "minutes_used": round((s["total_seconds"] or 0) / 60, 1),
                "limit_minutes": limit_min,
            })

        return _success(result)


# ── Admin: usage of their users ───────────────────────────────────────────────

class AdminUsageStatsView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    def get(self, request):
        if request.user.is_superadmin:
            # Superadmin: fetch usage for ALL users (regular users + admins),
            # then group totals by the admin who manages them.
            sessions = UsageSession.objects.filter(
                user__role__in=[CustomUser.Role.USER, CustomUser.Role.ADMIN]
            ).values(
                "user__id", "user__email", "user__role",
                "user__managed_by__id", "user__managed_by__email",
                "agent__id", "agent__name", "agent__slug",
            ).annotate(total_seconds=Sum("seconds_active"))

            agents: dict = {}   # per-agent platform totals
            admins: dict = {}   # per-admin totals (superadmin "by_user" view)

            for s in sessions:
                aid = str(s["agent__id"])
                minutes = round((s["total_seconds"] or 0) / 60, 1)

                # Platform-wide per-agent total
                if aid not in agents:
                    agents[aid] = {
                        "agent_id": aid,
                        "agent_name": s["agent__name"],
                        "agent_slug": s["agent__slug"],
                        "total_minutes": 0,
                    }
                agents[aid]["total_minutes"] = round(agents[aid]["total_minutes"] + minutes, 1)

                # Group under the managing admin.
                # If user is a regular user → group under managed_by admin.
                # If user IS an admin → group under themselves.
                if s["user__role"] == CustomUser.Role.ADMIN:
                    admin_id = str(s["user__id"])
                    admin_email = s["user__email"]
                else:
                    admin_id = str(s["user__managed_by__id"]) if s["user__managed_by__id"] else None
                    admin_email = s["user__managed_by__email"] or "No admin"

                if not admin_id:
                    continue

                if admin_id not in admins:
                    admins[admin_id] = {
                        "user_id": admin_id,
                        "user_email": admin_email,
                        "agents": {},
                    }
                if aid not in admins[admin_id]["agents"]:
                    admins[admin_id]["agents"][aid] = {
                        "agent_id": aid,
                        "agent_name": s["agent__name"],
                        "minutes_used": 0,
                    }
                admins[admin_id]["agents"][aid]["minutes_used"] = round(
                    admins[admin_id]["agents"][aid]["minutes_used"] + minutes, 1
                )

            return _success({
                "by_agent": list(agents.values()),
                "by_user": [
                    {**a, "agents": list(a["agents"].values())}
                    for a in admins.values()
                ],
            })

        else:
            # Admin sees their own managed users
            target_users = request.user.managed_users.filter(role=CustomUser.Role.USER)

            sessions = UsageSession.objects.filter(
                user__in=target_users
            ).values(
                "user__id", "user__email",
                "agent__id", "agent__name", "agent__slug",
            ).annotate(total_seconds=Sum("seconds_active"))

            agents: dict = {}
            users: dict = {}

            for s in sessions:
                uid = str(s["user__id"])
                aid = str(s["agent__id"])
                minutes = round((s["total_seconds"] or 0) / 60, 1)

                if aid not in agents:
                    agents[aid] = {
                        "agent_id": aid,
                        "agent_name": s["agent__name"],
                        "agent_slug": s["agent__slug"],
                        "total_minutes": 0,
                    }
                agents[aid]["total_minutes"] = round(agents[aid]["total_minutes"] + minutes, 1)

                if uid not in users:
                    users[uid] = {
                        "user_id": uid,
                        "user_email": s["user__email"],
                        "agents": {},
                    }
                users[uid]["agents"][aid] = {
                    "agent_id": aid,
                    "agent_name": s["agent__name"],
                    "minutes_used": minutes,
                }

            limits = AgentTimeLimit.objects.filter(
                target_user__in=target_users, set_by=request.user
            ).select_related("agent")
            limit_map: dict = {}
            for lim in limits:
                limit_map[(str(lim.target_user_id), str(lim.agent_id))] = lim.limit_minutes

            for uid, udata in users.items():
                for aid, adata in udata["agents"].items():
                    adata["limit_minutes"] = limit_map.get((uid, aid))

            return _success({
                "by_agent": list(agents.values()),
                "by_user": [
                    {**u, "agents": list(u["agents"].values())}
                    for u in users.values()
                ],
            })


# ── Time Limits: set / list / delete ─────────────────────────────────────────

class AgentTimeLimitView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    def get(self, request):
        """List all limits this user has set."""
        limits = AgentTimeLimit.objects.filter(set_by=request.user).select_related(
            "agent", "target_user"
        )
        data = [
            {
                "id": str(lim.id),
                "agent_id": str(lim.agent_id),
                "agent_name": lim.agent.name,
                "target_user_id": str(lim.target_user_id),
                "target_user_email": lim.target_user.email,
                "limit_minutes": lim.limit_minutes,
            }
            for lim in limits
        ]
        return _success(data)

    def post(self, request):
        """Create or update a time limit."""
        agent_id = request.data.get("agent_id")
        target_user_id = request.data.get("target_user_id")
        limit_minutes = request.data.get("limit_minutes")

        if not all([agent_id, target_user_id, limit_minutes]):
            return _error("agent_id, target_user_id, limit_minutes are required")

        try:
            limit_minutes = int(limit_minutes)
            if limit_minutes <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return _error("limit_minutes must be a positive integer")

        try:
            agent = Agent.objects.get(id=agent_id)
        except Agent.DoesNotExist:
            return _error("Agent not found", status.HTTP_404_NOT_FOUND)

        try:
            target_user = CustomUser.objects.get(id=target_user_id)
        except CustomUser.DoesNotExist:
            return _error("User not found", status.HTTP_404_NOT_FOUND)

        # Superadmin can restrict admins; admin can restrict their own users
        if request.user.is_superadmin:
            if target_user.role != CustomUser.Role.ADMIN:
                return _error("Superadmin can only set limits on admins")
        else:
            if target_user.managed_by != request.user:
                return _error("You can only set limits on your own users")

        lim, _ = AgentTimeLimit.objects.update_or_create(
            agent=agent, target_user=target_user,
            defaults={"set_by": request.user, "limit_minutes": limit_minutes},
        )
        return _success({
            "id": str(lim.id),
            "agent_name": agent.name,
            "target_user_email": target_user.email,
            "limit_minutes": lim.limit_minutes,
        }, status.HTTP_201_CREATED)


class AgentTimeLimitDeleteView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    def delete(self, request, limit_id):
        try:
            lim = AgentTimeLimit.objects.get(id=limit_id, set_by=request.user)
        except AgentTimeLimit.DoesNotExist:
            return _error("Limit not found", status.HTTP_404_NOT_FOUND)
        lim.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Check limit before opening chat ───────────────────────────────────────────

class CheckAgentLimitView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        try:
            agent = Agent.objects.get(slug=slug, is_active=True)
        except Agent.DoesNotExist:
            return _error("Agent not found", status.HTTP_404_NOT_FOUND)

        limit_min, used_min, exceeded = _check_limit_exceeded(request.user, agent)
        return _success({
            "agent_slug": slug,
            "limit_minutes": limit_min,
            "used_minutes": round(used_min, 1),
            "is_blocked": exceeded,
        })
