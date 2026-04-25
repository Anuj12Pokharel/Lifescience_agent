from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from apps.organizations.views import InternalCompaniesAllView, InternalCompanyUpsertView, InternalLogView, InternalReminderView, InternalSessionView


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    # ── Admin ─────────────────────────────────────────────────────────────────
    path("admin/", admin.site.urls),

    # ── Health check ──────────────────────────────────────────────────────────
    path("api/v1/health/", health_check, name="health-check"),

    # ── API docs (public) ─────────────────────────────────────────────────────
    path("api/schema/", SpectacularAPIView.as_view(permission_classes=[]), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema", permission_classes=[]), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema", permission_classes=[]), name="redoc"),

    # ── API v1 ────────────────────────────────────────────────────────────────
    path("api/v1/auth/", include("apps.accounts.urls", namespace="accounts")),
    path("api/v1/users/", include("apps.accounts.user_urls", namespace="users")),
    path("api/v1/agents/", include("apps.agents.urls", namespace="agents")),
    path("api/v1/groups/", include("apps.agents.group_urls", namespace="groups")),
    path("api/v1/company/", include("apps.company.urls", namespace="company")),
    path("api/v1/organizations/", include("apps.organizations.urls", namespace="organizations")),
    path("api/v1/integrations/", include("apps.integrations.urls", namespace="integrations")),

    # ── Internal: n8n → Django callbacks (token-authenticated, no JWT) ────────
    path("internal/companies/all", InternalCompaniesAllView.as_view(), name="internal-companies-all"),
    path("internal/companies/upsert", InternalCompanyUpsertView.as_view(), name="internal-company-upsert"),
    path("internal/sessions/", InternalSessionView.as_view(), name="internal-session-create"),
    path("internal/sessions/<str:session_id>", InternalSessionView.as_view(), name="internal-session-detail"),
    path("internal/logs", InternalLogView.as_view(), name="internal-log"),
    path("internal/reminders/", InternalReminderView.as_view(), name="internal-reminder-list"),
    path("internal/reminders/due/", InternalReminderView.as_view(), name="internal-reminder-due"),
    path("internal/reminders/<uuid:reminder_id>/sent/", InternalReminderView.as_view(), name="internal-reminder-sent"),

    # ── Internal: Spoke Node Registration (Hub-and-Spoke architecture) ────────
    # Called by Mac Mini edge nodes to self-register, send heartbeats, fetch config
    path("internal/spokes/", include("apps.organizations.spoke_urls")),
]


# ── Serve media files in development ─────────────────────────────────────────
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

    # django-debug-toolbar
    try:
        import debug_toolbar
        urlpatterns = [path("__debug__/", include(debug_toolbar.urls))] + urlpatterns
    except ImportError:
        pass
