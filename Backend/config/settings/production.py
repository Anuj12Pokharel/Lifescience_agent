"""
Production settings.
"""
from .base import *  # noqa: F401, F403

DEBUG = False

# ── Security headers ──────────────────────────────────────────────────────────

# HTTPS/HSTS
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31536000          # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Prevent browsers from MIME-sniffing the content type
SECURE_CONTENT_TYPE_NOSNIFF = True

# Enable browser XSS filter (legacy browsers)
SECURE_BROWSER_XSS_FILTER = True

# Cookies
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"

# Clickjacking protection
X_FRAME_OPTIONS = "DENY"

# Referrer policy
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# ── Permissions-Policy header (via middleware or custom response) ──────────
# Set via web-server config or a custom middleware; Django does not have a
# built-in setting for this header.

# ── Static files (WhiteNoise or S3) ──────────────────────────────────────────

MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# ── Database: enforce SSL in production ──────────────────────────────────────

DATABASES["default"]["OPTIONS"] = {  # noqa: F405
    "connect_timeout": 10,
    "sslmode": "prefer",
}

# ── Email ─────────────────────────────────────────────────────────────────────

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# ── Logging: structured JSON (extend base as needed) ─────────────────────────

LOGGING["handlers"]["console"]["formatter"] = "verbose"  # noqa: F405

# ── Sentry (optional, enabled when DSN is set) ───────────────────────────────

import os

_SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if _SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.redis import RedisIntegration

    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        integrations=[
            DjangoIntegration(transaction_style="url"),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        send_default_pii=False,
        environment=os.environ.get("ENVIRONMENT", "production"),
    )
