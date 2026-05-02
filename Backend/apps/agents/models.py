import uuid
from django.conf import settings
from django.db import models
from django.utils.text import slugify

# Re-export group models so Django migration scanner picks them up
from apps.agents.group_models import AgentGroup, AgentGroupAccess, AgentGroupMembership  # noqa: F401


class Agent(models.Model):
    class AgentType(models.TextChoices):
        CHATBOT = "chatbot", "Chatbot"
        ASSISTANT = "assistant", "Assistant"
        ANALYZER = "analyzer", "Analyzer"
        AUTOMATION = "automation", "Automation"
        CUSTOM = "custom", "Custom"

    class Status(models.TextChoices):
        LIVE = "live", "Live"
        OFFLINE = "offline", "Offline"
        MAINTENANCE = "maintenance", "Maintenance"

    class Latency(models.TextChoices):
        INSTANT = "instant", "Instant"
        FAST = "fast", "Fast"
        MODERATE = "moderate", "Moderate"
        SLOW = "slow", "Slow"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    subtitle = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    agent_type = models.CharField(
        max_length=30, choices=AgentType.choices, default=AgentType.CUSTOM
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.LIVE
    )
    latency = models.CharField(
        max_length=20, choices=Latency.choices, default=Latency.INSTANT
    )
    efficiency = models.PositiveSmallIntegerField(
        default=100,
        help_text="Efficiency percentage (0–100)"
    )
    system_prompt = models.TextField(
        blank=True,
        help_text="Instructions for the AI brain — defines agent personality, scope, and behavior.",
    )
    config = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agents_agent"
        verbose_name = "Agent"
        verbose_name_plural = "Agents"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["agent_type", "is_active"]),
        ]

    def __str__(self):
        return self.name

    def _generate_unique_slug(self):
        base_slug = slugify(self.name)
        slug = base_slug
        counter = 1
        while Agent.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)


class UserAgentAccess(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agent_accesses",
    )
    agent = models.ForeignKey(
        Agent,
        on_delete=models.CASCADE,
        related_name="user_accesses",
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_accesses",
    )
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agents_user_access"
        verbose_name = "User Agent Access"
        verbose_name_plural = "User Agent Accesses"
        unique_together = [("user", "agent")]
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["agent", "is_active"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self):
        return f"{self.user} → {self.agent}"

    @property
    def is_expired(self):
        from django.utils import timezone
        if self.expires_at and self.expires_at < timezone.now():
            return True
        return False

    @property
    def has_access(self):
        return self.is_active and not self.is_expired


class AgentUsageLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="usage_logs",
    )
    agent = models.ForeignKey(
        Agent,
        on_delete=models.SET_NULL,
        null=True,
        related_name="usage_logs",
    )
    action = models.CharField(max_length=100)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "agents_usage_log"
        verbose_name = "Agent Usage Log"
        verbose_name_plural = "Agent Usage Logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "agent"]),
            models.Index(fields=["action"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.user} | {self.agent} | {self.action}"


class UsageSession(models.Model):
    """Tracks active chat time per user per agent. Timer pauses when tab is inactive."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="usage_sessions",
    )
    agent = models.ForeignKey(
        Agent,
        on_delete=models.CASCADE,
        related_name="usage_sessions",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    # Active seconds accumulated (updated on heartbeat + end)
    seconds_active = models.PositiveIntegerField(default=0)
    last_heartbeat = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "agents_usage_session"
        verbose_name = "Usage Session"
        verbose_name_plural = "Usage Sessions"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["user", "agent"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["started_at"]),
        ]

    def __str__(self):
        return f"{self.user} | {self.agent} | {self.seconds_active}s"

    @property
    def minutes_active(self):
        return round(self.seconds_active / 60, 1)


class AgentTimeLimit(models.Model):
    """
    Time limit (in minutes) for an agent, scoped to a target user/admin.
    - Superadmin sets limit on an admin: target_user=admin, set_by=superadmin
    - Admin sets limit on a user: target_user=user, set_by=admin
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent = models.ForeignKey(
        Agent,
        on_delete=models.CASCADE,
        related_name="time_limits",
    )
    # The user/admin being restricted
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agent_time_limits",
    )
    # Who set this limit
    set_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="set_time_limits",
    )
    limit_minutes = models.PositiveIntegerField(help_text="Max allowed minutes for this agent")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agents_time_limit"
        verbose_name = "Agent Time Limit"
        verbose_name_plural = "Agent Time Limits"
        unique_together = [("agent", "target_user")]
        indexes = [
            models.Index(fields=["target_user"]),
            models.Index(fields=["agent", "target_user"]),
        ]

    def __str__(self):
        return f"{self.target_user} | {self.agent} | {self.limit_minutes}min"
