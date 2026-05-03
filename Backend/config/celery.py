import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("config")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    # Refresh expiring OAuth tokens every 5 minutes (out of the request path)
    "refresh-expiring-credentials": {
        "task": "agents.refresh_expiring_credentials",
        "schedule": 300.0,  # every 5 minutes
    },
    # ── Gmail token warm-up ───────────────────────────────────────────────────
    # Google access tokens expire in ~1 hour. This runs every 30 minutes to
    # proactively refresh any token that will expire within 45 minutes,
    # keeping admin Gmail connections permanently alive.
    "refresh-gmail-tokens": {
        "task": "integrations.refresh_gmail_tokens",
        "schedule": crontab(minute="*/30"),  # every 30 minutes
    },
}
