"""
Development settings — never use in production.
"""
from .base import *  # noqa: F401, F403

DEBUG = True

# Allow all local origins in development
ALLOWED_HOSTS = ["*"]

CORS_ALLOW_ALL_ORIGINS = True

# ── Security: relaxed for localhost ───────────────────────────────────────

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# ── DRF: add browsable API renderer in dev ─────────────────────────────────

REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
}

# ── django-debug-toolbar (only if installed) ──────────────────────────────

try:
    import debug_toolbar  # noqa: F401

    INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405
    MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")  # noqa: F405
    INTERNAL_IPS = ["127.0.0.1"]
except ImportError:
    pass
