from django.urls import path

from apps.agents.group_views import (
    GroupAgentRemoveView,
    GroupAgentView,
    GroupDetailView,
    GroupListCreateView,
    GroupMemberRemoveView,
    GroupMemberView,
    GroupToggleView,
    MyGroupsView,
)

# Include at /api/v1/groups/ in config/urls.py:
#   path("api/v1/groups/", include("apps.agents.group_urls", namespace="groups")),

app_name = "groups"

urlpatterns = [
    # ── User-facing ───────────────────────────────────────────────────────────
    path("my-groups/", MyGroupsView.as_view(), name="my-groups"),

    # ── SuperAdmin: Group CRUD ────────────────────────────────────────────────
    path("", GroupListCreateView.as_view(), name="list-create"),
    path("<uuid:pk>/", GroupDetailView.as_view(), name="detail"),
    path("<uuid:pk>/toggle/", GroupToggleView.as_view(), name="toggle"),

    # ── SuperAdmin: Member management ─────────────────────────────────────────
    path("<uuid:pk>/members/", GroupMemberView.as_view(), name="members"),
    path("<uuid:pk>/members/<uuid:user_id>/", GroupMemberRemoveView.as_view(), name="member-remove"),

    # ── SuperAdmin: Agent assignment ──────────────────────────────────────────
    path("<uuid:pk>/agents/", GroupAgentView.as_view(), name="group-agents"),
    path("<uuid:pk>/agents/<uuid:agent_id>/", GroupAgentRemoveView.as_view(), name="group-agent-remove"),
]
