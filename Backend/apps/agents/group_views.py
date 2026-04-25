from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CustomUser
from apps.accounts.permissions import IsAdminOrSuperAdmin, IsSuperAdmin
from apps.agents.group_models import AgentGroup, AgentGroupAccess, AgentGroupMembership
from apps.agents.group_serializers import (
    AddGroupAgentsSerializer,
    AddMembersSerializer,
    AgentGroupDetailSerializer,
    AgentGroupSerializer,
    AgentGroupWriteSerializer,
)
from apps.core.pagination import StandardResultsSetPagination


def _success(data=None, message="", status_code=status.HTTP_200_OK):
    body = {"success": True}
    if message:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return Response(body, status=status_code)


def _get_group_or_404(pk) -> AgentGroup:
    try:
        return AgentGroup.objects.select_related("created_by").get(pk=pk)
    except AgentGroup.DoesNotExist:
        raise NotFound("Group not found.")


def _check_group_scope(requester: CustomUser, group: AgentGroup) -> None:
    """Admin can only manage groups they created. Superadmin has no restriction."""
    if requester.is_superadmin:
        return
    if group.created_by_id != requester.id:
        raise PermissionDenied("You can only manage groups you created.")


# ── Group CRUD ────────────────────────────────────────────────────────────────

class GroupListCreateView(APIView):
    """
    GET  /api/v1/groups/
    - Superadmin: all groups
    - Admin: only groups they created

    POST /api/v1/groups/
    - Admin or Superadmin can create a group
    - created_by is always set to request.user
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request: Request) -> Response:
        if request.user.is_superadmin:
            qs = AgentGroup.objects.all()
        else:
            qs = AgentGroup.objects.filter(created_by=request.user)

        is_active = request.query_params.get("is_active")
        search = request.query_params.get("search", "").strip()

        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        if search:
            qs = qs.filter(name__icontains=search)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AgentGroupSerializer(page, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = AgentGroupWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save(created_by=request.user)
        return _success(
            data=AgentGroupSerializer(group).data,
            message=f"Group '{group.name}' created successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class GroupDetailView(APIView):
    """
    GET    /api/v1/groups/<uuid>/  — full detail with members + agents
    PATCH  /api/v1/groups/<uuid>/  — update name / description / is_active
    DELETE /api/v1/groups/<uuid>/  — hard delete group
    Admin: only for their own groups.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request: Request, pk) -> Response:
        group = _get_group_or_404(pk)
        _check_group_scope(request.user, group)
        return _success(data=AgentGroupDetailSerializer(group).data)

    def patch(self, request: Request, pk) -> Response:
        group = _get_group_or_404(pk)
        _check_group_scope(request.user, group)
        serializer = AgentGroupWriteSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return _success(
            data=AgentGroupSerializer(updated).data,
            message=f"Group '{updated.name}' updated.",
        )

    def delete(self, request: Request, pk) -> Response:
        group = _get_group_or_404(pk)
        _check_group_scope(request.user, group)
        name = group.name
        group.delete()
        return _success(message=f"Group '{name}' deleted.")


class GroupToggleView(APIView):
    """
    POST /api/v1/groups/<uuid>/toggle/
    Admin: only for their own groups.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request: Request, pk) -> Response:
        group = _get_group_or_404(pk)
        _check_group_scope(request.user, group)
        group.is_active = not group.is_active
        group.save(update_fields=["is_active", "updated_at"])
        state = "activated" if group.is_active else "deactivated"
        return _success(
            data={"id": str(group.id), "name": group.name, "is_active": group.is_active},
            message=f"Group '{group.name}' {state}.",
        )


# ── Member management ─────────────────────────────────────────────────────────

class GroupMemberView(APIView):
    """
    POST /api/v1/groups/<uuid>/members/
    Admin: can only add users they manage to their own groups.
    Superadmin: can add any user to any group.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request: Request, pk) -> Response:
        group = _get_group_or_404(pk)
        _check_group_scope(request.user, group)

        serializer = AddMembersSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Admin: validate all user_ids are their managed users
        if request.user.is_admin:
            user_ids = serializer.validated_data.get("user_ids", [])
            managed_ids = set(
                CustomUser.objects.filter(
                    managed_by=request.user, id__in=user_ids
                ).values_list("id", flat=True)
            )
            not_managed = [str(uid) for uid in user_ids if uid not in managed_ids]
            if not_managed:
                raise PermissionDenied(
                    f"You can only add users you manage. Not your users: {', '.join(not_managed)}"
                )

        result = serializer.save(group=group, added_by=request.user)
        return _success(
            data=result,
            message=(
                f"{result['added']} member(s) added, "
                f"{result['reactivated']} reactivated in '{group.name}'."
            ),
            status_code=status.HTTP_201_CREATED,
        )


class GroupMemberRemoveView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def delete(self, request: Request, pk, user_id) -> Response:
        group = _get_group_or_404(pk)
        _check_group_scope(request.user, group)
        try:
            membership = AgentGroupMembership.objects.select_related("user").get(
                group=group, user__id=user_id
            )
        except AgentGroupMembership.DoesNotExist:
            raise NotFound("This user is not a member of the group.")

        membership.is_active = False
        membership.save(update_fields=["is_active", "updated_at"])
        return _success(
            message=f"{membership.user.email} removed from '{group.name}'."
        )


# ── Agent assignment to group ─────────────────────────────────────────────────

class GroupAgentView(APIView):
    """
    POST /api/v1/groups/<uuid>/agents/
    Admin: can only assign agents they have access to, in their own groups.
    Superadmin: can assign any agent to any group.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request: Request, pk) -> Response:
        group = _get_group_or_404(pk)
        _check_group_scope(request.user, group)

        serializer = AddGroupAgentsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Admin: can assign any active agent (role grants full access).
        # Just verify all requested agent IDs actually exist and are active.
        if request.user.is_admin:
            from apps.agents.models import Agent
            agent_ids = serializer.validated_data.get("agent_ids", [])
            existing_ids = set(
                Agent.objects.filter(
                    id__in=agent_ids, is_active=True
                ).values_list("id", flat=True)
            )
            not_found = [str(aid) for aid in agent_ids if aid not in existing_ids]
            if not_found:
                raise PermissionDenied(
                    f"These agents do not exist or are inactive: {', '.join(not_found)}"
                )

        result = serializer.save(group=group, granted_by=request.user)
        return _success(
            data=result,
            message=(
                f"{result['added']} agent(s) added, "
                f"{result['reactivated']} reactivated in '{group.name}'."
            ),
            status_code=status.HTTP_201_CREATED,
        )


class GroupAgentRemoveView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def delete(self, request: Request, pk, agent_id) -> Response:
        group = _get_group_or_404(pk)
        _check_group_scope(request.user, group)
        try:
            access = AgentGroupAccess.objects.select_related("agent").get(
                group=group, agent__id=agent_id
            )
        except AgentGroupAccess.DoesNotExist:
            raise NotFound("This agent is not assigned to the group.")

        access.is_active = False
        access.save(update_fields=["is_active", "updated_at"])
        return _success(
            message=f"Agent '{access.agent.name}' removed from '{group.name}'."
        )


# ── User's own group memberships ──────────────────────────────────────────────

class MyGroupsView(APIView):
    """
    GET /api/v1/groups/my-groups/
    Returns all active groups the authenticated user belongs to,
    with the list of active agents in each group.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        memberships = (
            AgentGroupMembership.objects
            .filter(user=request.user, is_active=True, group__is_active=True)
            .select_related("group")
            .prefetch_related("group__agent_accesses__agent")
        )

        result = []
        for membership in memberships:
            group = membership.group
            agents = [
                {
                    "agent_id": str(ga.agent.id),
                    "name": ga.agent.name,
                    "subtitle": ga.agent.subtitle,
                    "description": ga.agent.description,
                    "slug": ga.agent.slug,
                    "agent_type": ga.agent.agent_type,
                    "status": ga.agent.status,
                    "latency": ga.agent.latency,
                    "efficiency": ga.agent.efficiency,
                    "agent_is_active": ga.agent.is_active,
                }
                for ga in group.agent_accesses.filter(is_active=True, agent__is_active=True)
            ]
            result.append({
                "group_id": str(group.id),
                "group_name": group.name,
                "group_description": group.description,
                "agents": agents,
            })

        return _success(data=result)
