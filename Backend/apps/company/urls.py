from django.urls import path
from . import views

app_name = "company"

urlpatterns = [
    # ── Company collection ────────────────────────────────────────────────────
    path("", views.CompanyListCreateView.as_view(), name="list-create"),

    # ── Company detail ────────────────────────────────────────────────────────
    path("<uuid:pk>/", views.CompanyDetailView.as_view(), name="detail"),
    path("<uuid:pk>/assign-admin/", views.CompanyAssignAdminView.as_view(), name="assign-admin"),

    # ── Events ────────────────────────────────────────────────────────────────
    path("events/", views.EventListView.as_view(), name="event-list"),
    path("events/<uuid:event_id>/", views.EventDetailView.as_view(), name="event-detail"),
    path("events/<uuid:event_id>/toggle/", views.EventToggleView.as_view(), name="event-toggle"),
]
