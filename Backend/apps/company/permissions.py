from rest_framework.permissions import BasePermission


class IsAdminOrSuperAdminOrReadOnly(BasePermission):
    """
    Allows read access to authenticated users, but only allows write access
    to admins or superadmins who are associated with the object.
    """
    message = "You must be an admin or super administrator to perform this action."

    def has_permission(self, request, view):
        # Allow read access to authenticated users
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return request.user and request.user.is_authenticated
        
        # Write access requires admin or superadmin role
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (
                request.user.Role.SUPERADMIN,
                request.user.Role.ADMIN,
            )
        )


class CanEditCompanyOrEvent(BasePermission):
    """
    Object-level permission to check if user can edit company or event.
    - Superadmins can always edit
    - Admins can edit only if they are associated (managed_by)
    """
    message = "You do not have permission to edit this resource."

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        return obj.can_be_edited_by(request.user)
