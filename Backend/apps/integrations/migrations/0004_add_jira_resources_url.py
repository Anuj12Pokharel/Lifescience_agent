from django.db import migrations


def add_resources_url(apps, schema_editor):
    AgentIntegrationProvider = apps.get_model("integrations", "AgentIntegrationProvider")
    for provider in AgentIntegrationProvider.objects.filter(provider="jira"):
        config = dict(provider.oauth_config)
        config["resources_url"] = "https://api.atlassian.com/oauth/token/accessible-resources"
        provider.oauth_config = config
        provider.save(update_fields=["oauth_config"])


def remove_resources_url(apps, schema_editor):
    AgentIntegrationProvider = apps.get_model("integrations", "AgentIntegrationProvider")
    for provider in AgentIntegrationProvider.objects.filter(provider="jira"):
        config = dict(provider.oauth_config)
        config.pop("resources_url", None)
        provider.oauth_config = config
        provider.save(update_fields=["oauth_config"])


class Migration(migrations.Migration):

    dependencies = [
        ("integrations", "0003_update_jira_scopes"),
    ]

    operations = [
        migrations.RunPython(add_resources_url, remove_resources_url),
    ]
