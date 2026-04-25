import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0007_session_config_creds_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="Reminder",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("company_id", models.CharField(blank=True, db_index=True, max_length=100)),
                ("user_id", models.CharField(blank=True, db_index=True, max_length=100)),
                ("user_name", models.CharField(blank=True, max_length=200)),
                ("user_email", models.CharField(blank=True, max_length=200)),
                ("session_id", models.CharField(blank=True, db_index=True, max_length=255)),
                ("message", models.TextField()),
                ("remind_at", models.DateTimeField(db_index=True)),
                ("is_sent", models.BooleanField(db_index=True, default=False)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("org", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="reminders",
                    to="organizations.organization",
                )),
            ],
            options={
                "verbose_name": "Reminder",
                "verbose_name_plural": "Reminders",
                "db_table": "organizations_reminder",
                "ordering": ["remind_at"],
                "indexes": [
                    models.Index(fields=["company_id", "is_sent"], name="reminder_company_sent_idx"),
                    models.Index(fields=["remind_at", "is_sent"], name="reminder_time_sent_idx"),
                ],
            },
        ),
    ]
