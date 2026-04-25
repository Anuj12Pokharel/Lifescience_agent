from django.urls import path

from apps.integrations.views import (
    ApiKeyConnectView,
    MessengerConfigView,
    OAuthCallbackView,
    OAuthInitiateView,
    OrgCredentialDisconnectView,
    OrgCredentialListView,
    IntegrationProviderListView,
    SuperAdminProviderListView,
    SuperAdminProviderDetailView,
)

app_name = "integrations"

urlpatterns = [
    # ── Superadmin: define which tools each agent supports ────────────────────
    path("admin/providers/", SuperAdminProviderListView.as_view(), name="admin-providers"),
    path("admin/providers/<uuid:pk>/", SuperAdminProviderDetailView.as_view(), name="admin-provider-detail"),

    # ── Providers catalog (admin reads available options per agent) ───────────
    path("providers/", IntegrationProviderListView.as_view(), name="providers"),

    # ── OAuth flow ────────────────────────────────────────────────────────────
    path("<uuid:provider_id>/connect/", OAuthInitiateView.as_view(), name="oauth-initiate"),
    path("callback/", OAuthCallbackView.as_view(), name="oauth-callback"),

    # ── API key connect ───────────────────────────────────────────────────────
    path("connect/apikey/", ApiKeyConnectView.as_view(), name="apikey-connect"),

    # ── My org's credentials ──────────────────────────────────────────────────
    path("credentials/", OrgCredentialListView.as_view(), name="credentials"),
    path("credentials/<uuid:pk>/disconnect/", OrgCredentialDisconnectView.as_view(), name="credential-disconnect"),

    # ── Messenger config (default channel) ───────────────────────────────────
    path("messenger-config/", MessengerConfigView.as_view(), name="messenger-config"),
]
