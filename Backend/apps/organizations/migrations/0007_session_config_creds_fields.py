from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0006_agentsession_user_fields"),
    ]

    operations = [
        # AgentSession — store full tracker_creds and messenger_creds blobs
        migrations.AddField(
            model_name="agentsession",
            name="tracker_creds",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="agentsession",
            name="messenger_creds",
            field=models.JSONField(blank=True, default=dict),
        ),
        # OrgAgentConfig — same, so /internal/companies/all can return them
        migrations.AddField(
            model_name="orgagentconfig",
            name="tracker_creds",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="orgagentconfig",
            name="messenger_creds",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
