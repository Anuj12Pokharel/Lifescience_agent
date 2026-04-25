"""
Fernet symmetric encryption for storing OAuth tokens and API keys.
Key is derived from Django's SECRET_KEY so no extra env var needed,
but you can set FERNET_KEY explicitly for key rotation.
"""
import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings


def _get_fernet() -> Fernet:
    raw_key = getattr(settings, "FERNET_KEY", None)
    if raw_key:
        key = raw_key.encode() if isinstance(raw_key, str) else raw_key
    else:
        # Derive a 32-byte key from SECRET_KEY via SHA-256
        digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt(value: str) -> str:
    """Encrypt a plaintext string and return a URL-safe base64 string."""
    if not value:
        return ""
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    """Decrypt a Fernet token and return the original plaintext string."""
    if not token:
        return ""
    return _get_fernet().decrypt(token.encode()).decode()
