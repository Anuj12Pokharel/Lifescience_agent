from django.db import migrations

NEW_SCOPES = [
    "offline_access",
    "read:issue-details:jira",
    "read:issue:jira",
    "write:issue:jira",
    "delete:issue:jira",
    "read:comment:jira",
    "write:comment:jira",
    "read:user:jira",
    "read:project:jira",
    "read:jira-user",
]


def update_jira_scopes(apps, schema_editor):
    AgentIntegrationProvider = apps.get_model("integrations", "AgentIntegrationProvider")
    for provider in AgentIntegrationProvider.objects.filter(provider="jira"):
        config = dict(provider.oauth_config)
        config["scopes"] = NEW_SCOPES
        provider.oauth_config = config
        provider.save(update_fields=["oauth_config"])


def revert_jira_scopes(apps, schema_editor):
    AgentIntegrationProvider = apps.get_model("integrations", "AgentIntegrationProvider")
    for provider in AgentIntegrationProvider.objects.filter(provider="jira"):
        config = dict(provider.oauth_config)
        config["scopes"] = ["offline_access", "read:jira-user", "read:jira-work", "write:jira-work"]
        provider.oauth_config = config
        provider.save(update_fields=["oauth_config"])


class Migration(migrations.Migration):

    dependencies = [
        ("integrations", "0002_rename_integrations_cred_org_active_idx_integ_cred_org_active_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(update_jira_scopes, revert_jira_scopes),
    ]
