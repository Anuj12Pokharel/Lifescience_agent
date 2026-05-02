import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Plan(models.Model):
    """
    Subscription plan. Free tier pre-seeded via migration.
    Paid tiers added later when billing is wired.
    """

    class Tier(models.TextChoices):
        FREE = "free", "Free"
        PRO = "pro", "Pro"
        ENTERPRISE = "enterprise", "Enterprise"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tier = models.CharField(max_length=20, choices=Tier.choices, unique=True)
    display_name = models.CharField(max_length=100)
    max_users = models.PositiveIntegerField(
        default=0, help_text="0 = unlimited"
    )
    max_agents = models.PositiveIntegerField(
        default=0, help_text="0 = unlimited"
    )
    price_usd_monthly = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "organizations_plan"
        verbose_name = "Plan"
        verbose_name_plural = "Plans"

    def __str__(self):
        return self.display_name

    @property
    def is_unlimited_users(self):
        return self.max_users == 0

    @property
    def is_unlimited_agents(self):
        return self.max_agents == 0


class Organization(models.Model):
    """
    Workspace owned by an admin. Every admin gets exactly one org on signup.
    Users belong to an org via OrgMembership.
    Superadmin can see/manage all orgs.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_organization",
        limit_choices_to={"role": "admin"},
    )
    plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
        related_name="organizations",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations_organization"
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    def _generate_unique_slug(self):
        base = slugify(self.name)
        slug = base
        counter = 1
        while Organization.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base}-{counter}"
            counter += 1
        return slug

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)

    def member_count(self):
        # Count users directly managed by this org's owner (primary relationship).
        # Also include any OrgMembership records for orgs that use that model.
        from django.db.models import Q
        managed = self.owner.managed_users.filter(is_active=True).count()
        membership = self.memberships.filter(is_active=True).exclude(
            user=self.owner
        ).count()
        return managed if managed > 0 else membership

    def can_add_user(self):
        if self.plan.is_unlimited_users:
            return True
        return self.member_count() < self.plan.max_users

    def enabled_agent_count(self):
        return self.agent_accesses.filter(is_enabled=True).count()

    def can_add_agent(self):
        if self.plan.is_unlimited_agents:
            return True
        return self.enabled_agent_count() < self.plan.max_agents


class OrgMembership(models.Model):
    """
    Links a user (role=user) to an organization.
    Created when admin invites a user.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="org_memberships",
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_invitations",
    )
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "organizations_membership"
        verbose_name = "Org Membership"
        verbose_name_plural = "Org Memberships"
        constraints = [
            models.UniqueConstraint(fields=["org", "user"], name="unique_org_user_membership"),
        ]
        indexes = [
            models.Index(fields=["org", "is_active"], name="org_membership_org_active_idx"),
            models.Index(fields=["user", "is_active"], name="org_membership_user_active_idx"),
        ]

    def __str__(self):
        return f"{self.user} → {self.org}"


class OrgAgentAccess(models.Model):
    """
    Subscription record: an org must have an active record here to access an agent.

    How a record gets created (subscription_type):
      - 'self'       → admin subscribed themselves via the catalog
      - 'superadmin' → superadmin explicitly granted access to this org

    is_enabled=False means access was revoked (superadmin can revoke at any time;
    admin can also unsubscribe by deleting or disabling their own subscription).
    Absence of a record = no access (opt-in model).
    """

    class SubscriptionType(models.TextChoices):
        SELF = "self", "Self Subscribed"
        SUPERADMIN = "superadmin", "Superadmin Granted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="agent_accesses",
    )
    agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.CASCADE,
        related_name="org_accesses",
    )
    is_enabled = models.BooleanField(default=True)
    subscription_type = models.CharField(
        max_length=20,
        choices=SubscriptionType.choices,
        default=SubscriptionType.SUPERADMIN,
    )
    subscribed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="org_agent_subscriptions",
    )
    subscribed_at = models.DateTimeField(auto_now_add=True)
    # Kept for superadmin revoke audit trail
    disabled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="disabled_org_agents",
    )
    disabled_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "organizations_org_agent_access"
        verbose_name = "Org Agent Access"
        verbose_name_plural = "Org Agent Accesses"
        constraints = [
            models.UniqueConstraint(fields=["org", "agent"], name="unique_org_agent_access"),
        ]
        indexes = [
            models.Index(fields=["org", "is_enabled"], name="orgagent_org_enabled_idx"),
            models.Index(fields=["agent", "is_enabled"], name="orgagent_agent_enabled_idx"),
        ]

    def __str__(self):
        state = "enabled" if self.is_enabled else "disabled"
        return f"{self.org} → {self.agent} [{state}]"


class UserAgentPermission(models.Model):
    """
    Admin grants a specific org member access to a specific agent.
    The agent must also be enabled for the org (OrgAgentAccess).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="user_agent_permissions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agent_permissions",
    )
    agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.CASCADE,
        related_name="user_permissions",
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="granted_agent_permissions",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations_user_agent_permission"
        verbose_name = "User Agent Permission"
        verbose_name_plural = "User Agent Permissions"
        constraints = [
            models.UniqueConstraint(fields=["org", "user", "agent"], name="unique_org_user_agent_perm"),
        ]
        indexes = [
            models.Index(fields=["user", "agent", "is_active"], name="uap_user_agent_active_idx"),
            models.Index(fields=["org", "is_active"], name="uap_org_active_idx"),
        ]

    def __str__(self):
        return f"{self.user} → {self.agent} in {self.org}"


class AgentSession(models.Model):
    """
    Session store for n8n agent conversations.
    n8n loads this on every message and saves it after processing.
    Keyed by session_id generated by the frontend.
    """
    session_id = models.CharField(max_length=255, unique=True, db_index=True)
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="agent_sessions",
    )
    agent_slug = models.CharField(max_length=180, blank=True)
    user_id = models.CharField(max_length=100, blank=True)
    # Tool state
    tracker = models.CharField(max_length=50, blank=True)
    tracker_creds = models.JSONField(default=dict, blank=True)
    messenger = models.CharField(max_length=50, blank=True)
    messenger_creds = models.JSONField(default=dict, blank=True)
    crm = models.CharField(max_length=50, blank=True)
    crm_creds = models.JSONField(default=dict, blank=True)
    default_channel = models.CharField(max_length=200, blank=True, null=True)
    # Project cache
    available_projects = models.JSONField(default=list, blank=True)
    last_project_key = models.CharField(max_length=100, blank=True, null=True)
    last_project_name = models.CharField(max_length=200, blank=True, null=True)
    projects_fetched_at = models.DateTimeField(null=True, blank=True)
    # User context (cached from JWT at session start)
    user_name = models.CharField(max_length=255, blank=True)
    user_email = models.EmailField(blank=True)
    gemini_api_key = models.CharField(max_length=500, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    # Conversation
    conversation_history = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations_agent_session"
        verbose_name = "Agent Session"
        verbose_name_plural = "Agent Sessions"
        indexes = [
            models.Index(fields=["org", "agent_slug"], name="session_org_agent_idx"),
        ]

    def __str__(self):
        return f"{self.session_id} ({self.org})"


class Reminder(models.Model):
    """
    Reminders set by users via the agent. Checked by n8n on a schedule.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="reminders",
        null=True, blank=True,
    )
    company_id = models.CharField(max_length=100, blank=True, db_index=True)
    user_id = models.CharField(max_length=100, blank=True, db_index=True)
    user_name = models.CharField(max_length=200, blank=True)
    user_email = models.CharField(max_length=200, blank=True)
    session_id = models.CharField(max_length=255, blank=True, db_index=True)
    message = models.TextField()
    remind_at = models.DateTimeField(db_index=True)
    is_sent = models.BooleanField(default=False, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "organizations_reminder"
        verbose_name = "Reminder"
        verbose_name_plural = "Reminders"
        ordering = ["remind_at"]
        indexes = [
            models.Index(fields=["company_id", "is_sent"], name="reminder_company_sent_idx"),
            models.Index(fields=["remind_at", "is_sent"], name="reminder_time_sent_idx"),
        ]

    def __str__(self):
        return f"{self.user_email} @ {self.remind_at}: {self.message[:50]}"


class OrgAgentConfig(models.Model):
    """
    Stores agent-specific runtime config for an org, written back by n8n.
    Examples: available Jira projects, default Slack channel, last fetch time.
    One record per (org, agent) pair — upserted by n8n after each session setup.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="agent_configs",
    )
    agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.CASCADE,
        related_name="org_configs",
    )
    # Tracker (Jira/Trello/etc.) cached state
    tracker = models.CharField(max_length=50, blank=True)
    tracker_creds = models.JSONField(default=dict, blank=True)
    available_projects = models.JSONField(default=list, blank=True)
    last_project_key = models.CharField(max_length=100, blank=True, null=True)
    last_project_name = models.CharField(max_length=200, blank=True, null=True)
    projects_fetched_at = models.DateTimeField(null=True, blank=True)
    projects_stale = models.BooleanField(default=True)
    # Messenger (Slack/WhatsApp/etc.) cached state
    messenger = models.CharField(max_length=50, blank=True)
    messenger_creds = models.JSONField(default=dict, blank=True)
    default_channel = models.CharField(max_length=200, blank=True, null=True)
    # CRM (GHL/HubSpot/etc.) cached state
    crm = models.CharField(max_length=50, blank=True)
    crm_creds = models.JSONField(default=dict, blank=True)
    # Any extra config n8n wants to store
    extra = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "organizations_org_agent_config"
        verbose_name = "Org Agent Config"
        verbose_name_plural = "Org Agent Configs"
        constraints = [
            models.UniqueConstraint(fields=["org", "agent"], name="unique_org_agent_config"),
        ]

    def __str__(self):
        return f"{self.org} → {self.agent} config"
