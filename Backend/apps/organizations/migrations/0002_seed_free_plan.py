"""Seed the Free plan so AdminRegisterView can always find it."""
import uuid
from django.db import migrations


def seed_free_plan(apps, schema_editor):
    Plan = apps.get_model("organizations", "Plan")
    Plan.objects.get_or_create(
        tier="free",
        defaults={
            "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
            "display_name": "Free",
            "max_users": 0,       # unlimited
            "max_agents": 0,      # unlimited
            "price_usd_monthly": 0,
            "is_active": True,
        },
    )


def remove_free_plan(apps, schema_editor):
    Plan = apps.get_model("organizations", "Plan")
    Plan.objects.filter(tier="free").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_free_plan, remove_free_plan),
    ]
