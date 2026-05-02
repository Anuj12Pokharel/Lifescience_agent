from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0004_agentgroup_agentgroupaccess_agentgroupmembership"),
    ]

    operations = [
        migrations.AddField(
            model_name="agent",
            name="system_prompt",
            field=models.TextField(
                blank=True,
                help_text="Instructions for the AI brain — defines agent personality, scope, and behavior.",
            ),
        ),
    ]
