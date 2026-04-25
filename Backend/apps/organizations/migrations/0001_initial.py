import uuid
import django.db.models.deletion
import django.utils.text
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("agents", "0004_agentgroup_agentgroupaccess_agentgroupmembership"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Plan",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tier", models.CharField(choices=[("free", "Free"), ("pro", "Pro"), ("enterprise", "Enterprise")], max_length=20, unique=True)),
                ("display_name", models.CharField(max_length=100)),
                ("max_users", models.PositiveIntegerField(default=0, help_text="0 = unlimited")),
                ("max_agents", models.PositiveIntegerField(default=0, help_text="0 = unlimited")),
                ("price_usd_monthly", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"db_table": "organizations_plan", "verbose_name": "Plan", "verbose_name_plural": "Plans"},
        ),
        migrations.CreateModel(
            name="Organization",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=200)),
                ("slug", models.SlugField(blank=True, max_length=220, unique=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.OneToOneField(
                    limit_choices_to={"role": "admin"},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="owned_organization",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("plan", models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="organizations",
                    to="organizations.plan",
                )),
            ],
            options={"db_table": "organizations_organization", "verbose_name": "Organization", "verbose_name_plural": "Organizations", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="OrgMembership",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("is_active", models.BooleanField(default=True)),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("org", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to="organizations.organization")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="org_memberships", to=settings.AUTH_USER_MODEL)),
                ("invited_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sent_invitations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "organizations_membership", "verbose_name": "Org Membership", "verbose_name_plural": "Org Memberships"},
        ),
        migrations.AddConstraint(
            model_name="orgmembership",
            constraint=models.UniqueConstraint(fields=("org", "user"), name="unique_org_user_membership"),
        ),
        migrations.AddIndex(
            model_name="orgmembership",
            index=models.Index(fields=["org", "is_active"], name="org_membership_org_active_idx"),
        ),
        migrations.AddIndex(
            model_name="orgmembership",
            index=models.Index(fields=["user", "is_active"], name="org_membership_user_active_idx"),
        ),
        migrations.CreateModel(
            name="OrgAgentAccess",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("is_enabled", models.BooleanField(default=True)),
                ("enabled_at", models.DateTimeField(auto_now_add=True)),
                ("disabled_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                ("org", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="agent_accesses", to="organizations.organization")),
                ("agent", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="org_accesses", to="agents.agent")),
                ("disabled_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="disabled_org_agents", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "organizations_org_agent_access", "verbose_name": "Org Agent Access", "verbose_name_plural": "Org Agent Accesses"},
        ),
        migrations.AddConstraint(
            model_name="orgagentaccess",
            constraint=models.UniqueConstraint(fields=("org", "agent"), name="unique_org_agent_access"),
        ),
        migrations.CreateModel(
            name="UserAgentPermission",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("org", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_agent_permissions", to="organizations.organization")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="agent_permissions", to=settings.AUTH_USER_MODEL)),
                ("agent", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="user_permissions", to="agents.agent")),
                ("granted_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="granted_agent_permissions", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "organizations_user_agent_permission", "verbose_name": "User Agent Permission", "verbose_name_plural": "User Agent Permissions"},
        ),
        migrations.AddConstraint(
            model_name="useragentpermission",
            constraint=models.UniqueConstraint(fields=("org", "user", "agent"), name="unique_org_user_agent_perm"),
        ),
    ]
