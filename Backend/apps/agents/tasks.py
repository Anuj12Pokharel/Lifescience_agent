from celery import shared_task


@shared_task(name="agents.refresh_expiring_credentials", ignore_result=True)
def refresh_expiring_credentials():
    """Refresh OAuth tokens expiring within the next 10 minutes. Runs every 5 min via Beat."""
    from apps.integrations.models import OrgIntegrationCredential
    from apps.integrations.oauth import refresh_access_token
    from django.core.cache import cache
    from django.utils import timezone
    import datetime

    threshold = timezone.now() + datetime.timedelta(minutes=10)
    expiring = OrgIntegrationCredential.objects.filter(
        is_active=True,
        token_expiry__lt=threshold,
        refresh_token__gt="",
    ).select_related("provider")

    for cred in expiring:
        try:
            refresh_access_token(cred)
            # Invalidate org credential cache so next request gets fresh token
            cache.delete_pattern(f"agent_creds_*")
        except Exception:
            pass
