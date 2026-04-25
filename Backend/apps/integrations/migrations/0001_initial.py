import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("agents", "0004_agentgroup_agentgroupaccess_agentgroupmembership"),
        ("organizations", "0002_seed_free_plan"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AgentIntegrationProvider",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("provider", models.CharField(help_text="e.g. jira, trello, slack, whatsapp, asana, hubspot", max_length=50)),
                ("display_name", models.CharField(max_length=100)),
                ("logo_url", models.URLField(blank=True)),
                ("auth_type", models.CharField(choices=[("oauth2", "OAuth 2.0"), ("apikey", "API Key")], default="oauth2", max_length=10)),
                ("oauth_config", models.JSONField(blank=True, default=dict, help_text="OAuth2 config: auth_url, token_url, scopes, client_id_setting, client_secret_setting")),
                ("field_schema", models.JSONField(blank=True, default=list, help_text="For apikey auth: list of field descriptors [{name, label, type}]")),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("agent", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="integration_providers", to="agents.agent")),
            ],
            options={"db_table": "integrations_provider", "verbose_name": "Integration Provider", "verbose_name_plural": "Integration Providers", "ordering": ["provider"]},
        ),
        migrations.AddConstraint(
            model_name="agentintegrationprovider",
            constraint=models.UniqueConstraint(fields=("agent", "provider"), name="unique_agent_provider"),
        ),
        migrations.CreateModel(
            name="OrgIntegrationCredential",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("access_token", models.TextField(blank=True, help_text="Fernet-encrypted access token")),
                ("refresh_token", models.TextField(blank=True, help_text="Fernet-encrypted refresh token")),
                ("token_expiry", models.DateTimeField(blank=True, null=True)),
                ("extra_data", models.TextField(blank=True, help_text="Fernet-encrypted JSON with provider-specific extras")),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("org", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="integration_credentials", to="organizations.organization")),
                ("provider", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="org_credentials", to="integrations.agentintegrationprovider")),
                ("connected_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="connected_integrations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "integrations_credential", "verbose_name": "Org Integration Credential", "verbose_name_plural": "Org Integration Credentials"},
        ),
        migrations.AddConstraint(
            model_name="orgintegrationcredential",
            constraint=models.UniqueConstraint(fields=("org", "provider"), name="unique_org_provider_credential"),
        ),
        migrations.AddIndex(
            model_name="orgintegrationcredential",
            index=models.Index(fields=["org", "is_active"], name="integrations_cred_org_active_idx"),
        ),
    ]
