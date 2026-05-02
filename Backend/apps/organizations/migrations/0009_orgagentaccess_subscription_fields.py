from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0008_reminder"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="orgagentaccess",
            name="subscription_type",
            field=models.CharField(
                choices=[("self", "Self Subscribed"), ("superadmin", "Superadmin Granted")],
                default="superadmin",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="orgagentaccess",
            name="subscribed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="org_agent_subscriptions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # Rename enabled_at → subscribed_at (same semantic, just clearer name).
        # We do this as add + remove since Django doesn't have a pure rename op
        # that works cleanly across all backends without data loss.
        migrations.RenameField(
            model_name="orgagentaccess",
            old_name="enabled_at",
            new_name="subscribed_at",
        ),
    ]
