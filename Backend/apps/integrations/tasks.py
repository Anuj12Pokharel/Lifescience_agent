"""
Celery tasks for the integrations app.

Includes a periodic task that proactively refreshes Gmail OAuth tokens
before they expire so invitation emails never fail due to an expired token.
"""
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

# Refresh tokens that expire within this many minutes
REFRESH_THRESHOLD_MINUTES = 45


@shared_task(
    name="integrations.refresh_gmail_tokens",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    ignore_result=True,
)
def refresh_gmail_tokens(self):
    """
    Proactively refresh all active Gmail OAuth tokens that expire soon.

    Scheduled to run every 30 minutes via Celery Beat.
    Tokens with less than 45 minutes remaining are refreshed.
    Tokens with no expiry (never expire) are skipped.
    """
    from apps.integrations.gmail_models import GmailCredential
    from apps.integrations.gmail_sender import _refresh_gmail_token

    threshold = timezone.now() + timezone.timedelta(minutes=REFRESH_THRESHOLD_MINUTES)

    # Find credentials that are active and will expire soon
    expiring = GmailCredential.objects.filter(
        is_active=True,
        token_expiry__isnull=False,
        token_expiry__lte=threshold,
    )

    refreshed = 0
    failed = 0

    for cred in expiring:
        try:
            _refresh_gmail_token(cred)
            refreshed += 1
            logger.info(
                "Refreshed Gmail token for org=%s email=%s",
                cred.org_id,
                cred.gmail_email,
            )
        except Exception as exc:
            failed += 1
            logger.warning(
                "Failed to refresh Gmail token for org=%s email=%s: %s",
                cred.org_id,
                cred.gmail_email,
                exc,
            )

    logger.info(
        "Gmail token refresh complete: %d refreshed, %d failed",
        refreshed,
        failed,
    )
    return {"refreshed": refreshed, "failed": failed}
