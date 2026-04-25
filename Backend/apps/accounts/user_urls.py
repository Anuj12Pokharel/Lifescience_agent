from django.urls import path

from apps.accounts.views import (
    AdminInviteUserView,
    AssignCompanyView,
    AssignManagerView,
    MyGrantedAgentsView,
    UserAccessDiagnosticView,
    UserActivateView,
    UserAgentGrantView,
    UserAgentListView,
    UserAgentToggleView,
    UserDeactivateView,
    UserDetailView,
    UserListView,
    UserLockView,
    UserUnlockView,
    UserUpdateRoleView,
)

# Include at /api/v1/users/ in the project's root urls.py:
#   path("api/v1/users/", include("apps.accounts.user_urls", namespace="users")),

app_name = "users"

urlpatterns = [
    # ── Collection ────────────────────────────────────────────────────────────
    path("", UserListView.as_view(), name="list"),

    # ── Admin: see agents granted to me ──────────────────────────────────────
    path("my-agents/", MyGrantedAgentsView.as_view(), name="my-agents"),

    # ── Invite (admin or superadmin creates a user) ───────────────────────────
    path("invite/", AdminInviteUserView.as_view(), name="invite"),

    # ── Single-user operations ────────────────────────────────────────────────
    path("<uuid:pk>/", UserDetailView.as_view(), name="detail"),
    path("<uuid:pk>/role/", UserUpdateRoleView.as_view(), name="update-role"),
    path("<uuid:pk>/activate/", UserActivateView.as_view(), name="activate"),
    path("<uuid:pk>/deactivate/", UserDeactivateView.as_view(), name="deactivate"),
    path("<uuid:pk>/lock/", UserLockView.as_view(), name="lock"),
    path("<uuid:pk>/unlock/", UserUnlockView.as_view(), name="unlock"),

    # ── Superadmin: assign which admin manages a user ─────────────────────────
    path("<uuid:pk>/assign-manager/", AssignManagerView.as_view(), name="assign-manager"),
    path("<uuid:pk>/assign-company/", AssignCompanyView.as_view(), name="assign-company"),

    # ── Agent access management per user ──────────────────────────────────────
    path("<uuid:pk>/agents/", UserAgentListView.as_view(), name="user-agents"),
    path("<uuid:pk>/agents/grant/", UserAgentGrantView.as_view(), name="user-agents-grant"),
    path("<uuid:pk>/agents/<uuid:agent_id>/toggle/", UserAgentToggleView.as_view(), name="user-agents-toggle"),
    path("<uuid:pk>/access-diagnostic/", UserAccessDiagnosticView.as_view(), name="access-diagnostic"),
]
