import uuid

from django.conf import settings
from django.db import models


class AgentIntegrationProvider(models.Model):
    """
    Superadmin defines which external tools an agent supports and HOW to connect.

    auth_type:
      - oauth2  → user clicks "Connect X", backend handles OAuth dance
      - apikey  → user pastes an API key manually (fallback / simple tools)

    oauth_config (JSON for oauth2):
      {
        "client_id_setting": "JIRA_CLIENT_ID",   ← env var name
        "client_secret_setting": "JIRA_CLIENT_SECRET",
        "auth_url": "https://auth.atlassian.com/authorize",
        "token_url": "https://auth.atlassian.com/oauth/token",
        "scopes": ["offline_access", "read:issue-details:jira", "read:issue:jira", "write:issue:jira", "delete:issue:jira", "read:comment:jira", "write:comment:jira", "read:user:jira", "read:project:jira", "read:jira-user"],
        "extra_params": {"audience": "api.atlassian.com"}
      }

    field_schema (JSON for apikey fallback):
      [
        {"name": "api_token", "label": "API Token", "type": "password"},
        {"name": "base_url",  "label": "Base URL",  "type": "text"},
        {"name": "email",     "label": "Email",     "type": "email"}
      ]
    """

    class AuthType(models.TextChoices):
        OAUTH2 = "oauth2", "OAuth 2.0"
        APIKEY = "apikey", "API Key"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.CASCADE,
        related_name="integration_providers",
    )
    provider = models.CharField(
        max_length=50,
        help_text="e.g. jira, trello, slack, whatsapp, asana, hubspot",
    )
    display_name = models.CharField(max_length=100)
    logo_url = models.URLField(blank=True)
    auth_type = models.CharField(
        max_length=10, choices=AuthType.choices, default=AuthType.OAUTH2
    )
    oauth_config = models.JSONField(
        default=dict, blank=True,
        help_text="OAuth2 config: auth_url, token_url, scopes, client_id_setting, client_secret_setting",
    )
    field_schema = models.JSONField(
        default=list, blank=True,
        help_text="For apikey auth: list of field descriptors [{name, label, type}]",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "integrations_provider"
        verbose_name = "Integration Provider"
        verbose_name_plural = "Integration Providers"
        constraints = [
            models.UniqueConstraint(fields=["agent", "provider"], name="unique_agent_provider"),
        ]
        ordering = ["provider"]

    def __str__(self):
        return f"{self.agent.name} ↔ {self.display_name}"


class OrgIntegrationCredential(models.Model):
    """
    Stores OAuth tokens or API keys for an org's chosen provider for an agent.
    All sensitive values are Fernet-encrypted before saving.

    One org can have ONE credential per (agent, provider) pair.
    If they want to switch from Jira to Trello they disconnect Jira first.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="integration_credentials",
    )
    provider = models.ForeignKey(
        AgentIntegrationProvider,
        on_delete=models.CASCADE,
        related_name="org_credentials",
    )
    # OAuth fields (encrypted)
    access_token = models.TextField(blank=True, help_text="Fernet-encrypted access token")
    refresh_token = models.TextField(blank=True, help_text="Fernet-encrypted refresh token")
    token_expiry = models.DateTimeField(null=True, blank=True)
    # Extra provider-specific data (workspace_id, team_id, etc.) — encrypted JSON string
    extra_data = models.TextField(
        blank=True,
        help_text="Fernet-encrypted JSON with provider-specific extras (workspace_id etc.)",
    )
    # Who connected it
    connected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="connected_integrations",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "integrations_credential"
        verbose_name = "Org Integration Credential"
        verbose_name_plural = "Org Integration Credentials"
        constraints = [
            models.UniqueConstraint(fields=["org", "provider"], name="unique_org_provider_credential"),
        ]
        indexes = [
            models.Index(fields=["org", "is_active"], name="integ_cred_org_active_idx"),
        ]

    def __str__(self):
        return f"{self.org} ↔ {self.provider}"

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

    def set_extra_data(self, data: dict):
        import json
        from apps.integrations.encryption import encrypt
        self.extra_data = encrypt(json.dumps(data))

    def get_extra_data(self) -> dict:
        import json
        from apps.integrations.encryption import decrypt
        raw = decrypt(self.extra_data)
        if not raw:
            return {}
        return json.loads(raw)

    @property
    def is_expired(self):
        from django.utils import timezone
        if not self.token_expiry:
            return False  # no expiry set = token never expires (e.g. Slack)
        return self.token_expiry < timezone.now()
