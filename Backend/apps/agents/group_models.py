import uuid
from django.conf import settings
from django.db import models


class AgentGroup(models.Model):
    """
    A named group (e.g. "Manager Team", "Sales Team").
    Agents are assigned to the group; users are added as members.
    Any active member automatically gets access to all active agents in the group.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agents_group"
        verbose_name = "Agent Group"
        verbose_name_plural = "Agent Groups"
        ordering = ["name"]

    def __str__(self):
        return self.name


class AgentGroupMembership(models.Model):
    """
    Links a user to a group. While is_active=True, the user inherits
    access to all agents assigned to that group.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        AgentGroup,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )
    is_active = models.BooleanField(default=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="added_memberships",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agents_group_membership"
        verbose_name = "Group Membership"
        verbose_name_plural = "Group Memberships"
        unique_together = [("group", "user")]
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["group", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user} → {self.group}"


class AgentGroupAccess(models.Model):
    """
    Assigns an agent to a group.
    All active members of the group get access to this agent while is_active=True.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(
        AgentGroup,
        on_delete=models.CASCADE,
        related_name="agent_accesses",
    )
    agent = models.ForeignKey(
        "agents.Agent",
        on_delete=models.CASCADE,
        related_name="group_accesses",
    )
    is_active = models.BooleanField(default=True)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="granted_group_accesses",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agents_group_access"
        verbose_name = "Group Agent Access"
        verbose_name_plural = "Group Agent Accesses"
        unique_together = [("group", "agent")]
        indexes = [
            models.Index(fields=["group", "is_active"]),
            models.Index(fields=["agent", "is_active"]),
        ]

    def __str__(self):
        return f"{self.group} → {self.agent}"
