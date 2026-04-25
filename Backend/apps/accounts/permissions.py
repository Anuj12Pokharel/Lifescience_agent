from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsSuperAdmin(BasePermission):
    """
    Grants access only to users with role=superadmin.
    """
    message = "You must be a super administrator to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superadmin
        )


class IsAdminOrSuperAdmin(BasePermission):
    """
    Grants access to users with role=admin OR role=superadmin.
    Use this for endpoints that both admins and superadmins can reach,
    but where the view itself narrows the queryset based on role.
    """
    message = "You must be an admin or super administrator to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (
                request.user.Role.SUPERADMIN,
                request.user.Role.ADMIN,
            )
        )


class IsOwnerOrSuperAdmin(BasePermission):
    """
    Object-level: grants write access to the owner of an object or a superadmin.
    Read access (SAFE_METHODS) requires authentication only.

    Supports objects that are:
      - a CustomUser instance directly
      - any model with a `user` FK/OneToOne attribute pointing to a CustomUser
    """
    message = "You do not have permission to access this resource."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superadmin:
            return True

        # Resolve the owner from the object
        owner = getattr(obj, "user", obj)
        return owner == request.user


class HasAgentAccess(BasePermission):
    """
    Grants access when the authenticated user has an active, non-expired
    UserAgentAccess record for the target agent.

    Superadmins bypass the check entirely.

    Resolution order for identifying the target agent:
      has_permission  — uses URL kwargs: `slug`, `agent_slug`, `agent_pk`, `pk`
      has_object_permission — receives the Agent (or UserAgentAccess) instance directly
    """
    message = "You do not have access to this agent."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superadmin:
            return True

        # Try to resolve the agent from URL kwargs eagerly.
        # If no agent identifier is present the view itself is responsible
        # for further access control (e.g. list views filtered to own agents).
        agent_slug = view.kwargs.get("slug") or view.kwargs.get("agent_slug")
        agent_pk = view.kwargs.get("agent_pk") or view.kwargs.get("pk")

        if not agent_slug and not agent_pk:
            # No specific agent targeted yet — allow through to object-level check
            return True

        return self._check_access(request.user, slug=agent_slug, pk=agent_pk)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superadmin:
            return True

        from apps.agents.models import Agent, UserAgentAccess

        # Accept an Agent instance or a UserAgentAccess instance
        if isinstance(obj, UserAgentAccess):
            return obj.user == request.user and obj.has_access

        if isinstance(obj, Agent):
            return self._check_access(request.user, pk=obj.pk)

        return False

    @staticmethod
    def _check_access(user, slug=None, pk=None):
        from apps.agents.models import UserAgentAccess

        filters = {"user": user}
        if slug:
            filters["agent__slug"] = slug
        elif pk:
            filters["agent__id"] = pk
        else:
            return False

        try:
            access = UserAgentAccess.objects.select_related("agent").get(**filters)
            return access.has_access
        except UserAgentAccess.DoesNotExist:
            return False
