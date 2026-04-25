from django.urls import path

from apps.agents.views import (
    AgentAccessRevokeView,
    AgentAccessView,
    AgentDetailView,
    AgentExecuteView,
    AgentListCreateView,
    AgentToggleStatusView,
    MyAgentsView,
    PublicAgentListView,
)

# Include at /api/v1/agents/ in the project's root urls.py:
#   path("api/v1/agents/", include("apps.agents.urls", namespace="agents")),

app_name = "agents"

urlpatterns = [
    # ── Public (no auth) ─────────────────────────────────────────────────────
    path("public/", PublicAgentListView.as_view(), name="public-list"),

    # ── User-facing (must come BEFORE <slug> to avoid slug collision) ─────────
    path("my-agents/", MyAgentsView.as_view(), name="my-agents"),

    # ── User: execute agent ───────────────────────────────────────────────────
    path("<slug:slug>/execute/", AgentExecuteView.as_view(), name="execute"),

    # ── SuperAdmin: Agent CRUD ────────────────────────────────────────────────
    path("", AgentListCreateView.as_view(), name="list-create"),
    path("<slug:slug>/", AgentDetailView.as_view(), name="detail"),
    path("<slug:slug>/toggle-status/", AgentToggleStatusView.as_view(), name="toggle-status"),

    # ── SuperAdmin: Access management ─────────────────────────────────────────
    path("<slug:slug>/access/", AgentAccessView.as_view(), name="access"),
    path("<slug:slug>/access/<uuid:user_id>/", AgentAccessRevokeView.as_view(), name="access-revoke"),
]
