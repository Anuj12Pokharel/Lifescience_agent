"""
Spoke Node URL Patterns
Registered under /internal/spokes/ in config/urls.py
"""

from django.urls import path
from .spoke_views import SpokeListView, SpokeRegisterView, SpokeDetailView, SpokeHeartbeatView

urlpatterns = [
    # List all spokes
    path("", SpokeListView.as_view(), name="spoke-list"),

    # Self-register or update spoke config
    path("register/", SpokeRegisterView.as_view(), name="spoke-register"),

    # Get or deregister a specific spoke
    path("<slug:spoke_id>/", SpokeDetailView.as_view(), name="spoke-detail"),

    # Periodic heartbeat ping
    path("<slug:spoke_id>/heartbeat/", SpokeHeartbeatView.as_view(), name="spoke-heartbeat"),
]
