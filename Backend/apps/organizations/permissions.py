from rest_framework.permissions import BasePermission

from apps.organizations.models import OrgAgentAccess, UserAgentPermission


class IsOrgOwner(BasePermission):
    """Request user is the admin owner of their organization."""
    message = "You must be an organization owner to perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_admin
            and hasattr(request.user, "owned_organization")
        )


class HasOrgAgentAccess(BasePermission):
    """
    The org has this agent enabled AND the requesting user has been
    individually granted access by their admin.
    Superadmins bypass both checks.
    """
    message = "You do not have access to this agent."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superadmin:
            return True

        agent_pk = view.kwargs.get("agent_pk") or view.kwargs.get("pk")
        agent_slug = view.kwargs.get("slug") or view.kwargs.get("agent_slug")

        if not agent_pk and not agent_slug:
            return True  # let object-level handle it

        return self._check(request.user, agent_pk=agent_pk, agent_slug=agent_slug)

    @staticmethod
    def _check(user, agent_pk=None, agent_slug=None):
        # Resolve org — regular users belong via OrgMembership
        try:
            membership = user.org_memberships.select_related("org").get(is_active=True)
            org = membership.org
        except Exception:
            return False

        # Build agent filter
        agent_filter = {}
        if agent_pk:
            agent_filter["agent__id"] = agent_pk
        elif agent_slug:
            agent_filter["agent__slug"] = agent_slug
        else:
            return False

        # 1. Org-level check: no record = enabled by default.
        #    Only an explicit is_enabled=False record blocks access.
        explicitly_disabled = OrgAgentAccess.objects.filter(
            org=org, is_enabled=False, **agent_filter
        ).exists()
        if explicitly_disabled:
            return False

        # 2. User must have been granted access by their admin
        return UserAgentPermission.objects.filter(
            org=org, user=user, is_active=True, **agent_filter
        ).exists()
