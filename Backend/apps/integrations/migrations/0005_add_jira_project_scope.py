from django.db import migrations

NEW_SCOPE = "manage:jira-project"


def add_project_scope(apps, schema_editor):
    AgentIntegrationProvider = apps.get_model("integrations", "AgentIntegrationProvider")
    for provider in AgentIntegrationProvider.objects.filter(provider="jira"):
        config = dict(provider.oauth_config)
        scopes = list(config.get("scopes", []))
        if NEW_SCOPE not in scopes:
            scopes.append(NEW_SCOPE)
            config["scopes"] = scopes
            provider.oauth_config = config
            provider.save(update_fields=["oauth_config"])


def remove_project_scope(apps, schema_editor):
    AgentIntegrationProvider = apps.get_model("integrations", "AgentIntegrationProvider")
    for provider in AgentIntegrationProvider.objects.filter(provider="jira"):
        config = dict(provider.oauth_config)
        scopes = [s for s in config.get("scopes", []) if s != NEW_SCOPE]
        config["scopes"] = scopes
        provider.oauth_config = config
        provider.save(update_fields=["oauth_config"])


class Migration(migrations.Migration):

    dependencies = [
        ("integrations", "0004_add_jira_resources_url"),
    ]

    operations = [
        migrations.RunPython(add_project_scope, remove_project_scope),
    ]
