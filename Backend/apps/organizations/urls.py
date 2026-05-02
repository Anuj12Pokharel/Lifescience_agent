from django.urls import path

from apps.organizations.views import (
    AdminAgentCatalogView,
    AdminAgentSubscribeView,
    AdminStatsView,
    MyOrganizationView,
    OrgAgentAccessListView,
    OrgAgentToggleView,
    OrgMemberListView,
    OrganizationDetailView,
    OrganizationListView,
    UserAgentPermissionDetailView,
    UserAgentPermissionListView,
)

app_name = "organizations"

urlpatterns = [
    # ── Admin: my org ─────────────────────────────────────────────────────────
    path("me/", MyOrganizationView.as_view(), name="my-org"),
    path("me/stats/", AdminStatsView.as_view(), name="my-org-stats"),
    path("me/members/", OrgMemberListView.as_view(), name="my-org-members"),
    path("me/agents/", AdminAgentCatalogView.as_view(), name="my-org-agents"),
    path("me/agents/<uuid:agent_id>/subscribe/", AdminAgentSubscribeView.as_view(), name="my-org-agent-subscribe"),
    path("me/agent-permissions/", UserAgentPermissionListView.as_view(), name="agent-permissions"),
    path("me/agent-permissions/<uuid:pk>/", UserAgentPermissionDetailView.as_view(), name="agent-permission-detail"),

    # ── Superadmin: all orgs ──────────────────────────────────────────────────
    path("", OrganizationListView.as_view(), name="list"),
    path("<uuid:pk>/", OrganizationDetailView.as_view(), name="detail"),
    path("<uuid:org_pk>/agents/", OrgAgentAccessListView.as_view(), name="org-agents"),
    path("<uuid:org_pk>/agents/<uuid:agent_pk>/toggle/", OrgAgentToggleView.as_view(), name="org-agent-toggle"),
]
