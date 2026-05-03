"""
GmailCredential model — stores an org's connected Gmail OAuth tokens.
Kept separate from AgentIntegrationProvider to avoid coupling
the agent-tools system with the email-sending system.
"""
import uuid

from django.conf import settings
from django.db import models


class GmailCredential(models.Model):
    """
    One per org. Stores the OAuth tokens for the admin's connected Gmail account.
    Used to send invitation emails from the admin's own Gmail address.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.OneToOneField(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="gmail_credential",
    )
    gmail_email = models.EmailField(
        help_text="The Gmail address that was connected (for display only)."
    )
    # Fernet-encrypted tokens
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    token_expiry = models.DateTimeField(null=True, blank=True)

    connected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="connected_gmail",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "integrations_gmail_credential"
        verbose_name = "Gmail Credential"
        verbose_name_plural = "Gmail Credentials"

    def __str__(self):
        return f"{self.org} ↔ {self.gmail_email}"

    # ── Encryption helpers ────────────────────────────────────────────────────

    def set_access_token(self, plaintext: str):
        from apps.integrations.encryption import encrypt
        self.access_token = encrypt(plaintext)

    def get_access_token(self) -> str:
        from apps.integrations.encryption import decrypt
        return decrypt(self.access_token)

    def set_refresh_token(self, plaintext: str):
        from apps.integrations.encryption import encrypt
        self.refresh_token = encrypt(plaintext)

    def get_refresh_token(self) -> str:
        from apps.integrations.encryption import decrypt
        return decrypt(self.refresh_token)

    @property
    def is_expired(self):
        from django.utils import timezone
        if not self.token_expiry:
            return False
        return self.token_expiry < timezone.now()
