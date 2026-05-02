from django.urls import path
from apps.agents.usage_views import (
    AdminUsageStatsView,
    AgentTimeLimitDeleteView,
    AgentTimeLimitView,
    CheckAgentLimitView,
    MyUsageStatsView,
    UsageSessionEndView,
    UsageSessionHeartbeatView,
    UsageSessionStartView,
)

app_name = "usage"

urlpatterns = [
    # User: session lifecycle
    path("sessions/start/", UsageSessionStartView.as_view(), name="session-start"),
    path("sessions/<uuid:session_id>/heartbeat/", UsageSessionHeartbeatView.as_view(), name="session-heartbeat"),
    path("sessions/<uuid:session_id>/end/", UsageSessionEndView.as_view(), name="session-end"),

    # User: my stats
    path("my/", MyUsageStatsView.as_view(), name="my-stats"),

    # User: check limit before opening chat
    path("check/<slug:slug>/", CheckAgentLimitView.as_view(), name="check-limit"),

    # Admin / Superadmin: stats
    path("admin/", AdminUsageStatsView.as_view(), name="admin-stats"),

    # Admin / Superadmin: manage time limits
    path("limits/", AgentTimeLimitView.as_view(), name="limits"),
    path("limits/<uuid:limit_id>/", AgentTimeLimitDeleteView.as_view(), name="limit-delete"),
]
