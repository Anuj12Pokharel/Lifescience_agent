from django.urls import path
from apps.organizations.views import InternalCompanyUpsertView, InternalSessionView

urlpatterns = [
    path("", InternalCompanyUpsertView.as_view(), name="internal-company-upsert"),
]
