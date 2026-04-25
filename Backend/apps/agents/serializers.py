from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import CustomUser
from apps.agents.models import Agent, UserAgentAccess


# ── Minimal user embed (avoids circular import with accounts.serializers) ─────

class AgentUserSerializer(serializers.ModelSerializer):
    """Lightweight user representation embedded in agent-related responses."""

    class Meta:
        model = CustomUser
        fields = ["id", "email", "role"]
        read_only_fields = fields


# ── Agent serializers ─────────────────────────────────────────────────────────

class AgentSerializer(serializers.ModelSerializer):
    """
    Single serializer for both read and write (create + edit).
    Only `name` is required. All other fields are optional with sensible defaults.
    Pass partial=True for PATCH.
    """
    subtitle = serializers.CharField(required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    agent_type = serializers.ChoiceField(
        choices=Agent.AgentType.choices,
        default=Agent.AgentType.CUSTOM,
        required=False,
    )
    status = serializers.ChoiceField(
        choices=Agent.Status.choices,
        default=Agent.Status.LIVE,
        required=False,
    )
    latency = serializers.ChoiceField(
        choices=Agent.Latency.choices,
        default=Agent.Latency.INSTANT,
        required=False,
    )
    efficiency = serializers.IntegerField(
        min_value=0, max_value=100, default=100, required=False
    )
    config = serializers.JSONField(required=False, default=dict)

    class Meta:
        model = Agent
        fields = [
            "id",
            "name",
            "subtitle",
            "description",
            "slug",
            "agent_type",
            "status",
            "latency",
            "efficiency",
            "config",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]

    def create(self, validated_data: dict) -> Agent:
        return Agent.objects.create(**validated_data)

    def update(self, instance: Agent, validated_data: dict) -> Agent:
        if "name" in validated_data and validated_data["name"] != instance.name:
            instance.slug = ""
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class AgentListSerializer(serializers.ModelSerializer):
    """Compact read-only serializer for list endpoints — omits config blob."""

    class Meta:
        model = Agent
        fields = [
            "id",
            "name",
            "subtitle",
            "description",
            "slug",
            "agent_type",
            "status",
            "latency",
            "efficiency",
            "is_active",
            "created_at",
        ]
        read_only_fields = fields


# ── Access serializers ────────────────────────────────────────────────────────

class UserAgentAccessSerializer(serializers.ModelSerializer):
    """Full read serializer for a UserAgentAccess record, used in admin views."""
    user = AgentUserSerializer(read_only=True)
    granted_by = AgentUserSerializer(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    has_access = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserAgentAccess
        fields = [
            "id",
            "user",
            "granted_by",
            "is_active",
            "expires_at",
            "is_expired",
            "has_access",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class GrantAccessSerializer(serializers.Serializer):
    """
    Write serializer for granting (or updating) a user's access to an agent.

    Fields:
        user_id    — UUID of the target user (must be active)
        expires_at — Optional future datetime; null means no expiry
    """
    user_id = serializers.UUIDField()
    expires_at = serializers.DateTimeField(required=False, allow_null=True, default=None)

    def validate_user_id(self, value) -> object:
        try:
            self._target_user = CustomUser.objects.get(pk=value, is_active=True)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError(
                "No active user found with this ID."
            )
        return value

    def validate_expires_at(self, value):
        if value is not None and value <= timezone.now():
            raise serializers.ValidationError("Expiry date must be in the future.")
        return value

    def save(self, *, agent: Agent, granted_by: CustomUser) -> tuple[UserAgentAccess, bool]:
        """
        Upsert: creates a new record if none exists, otherwise re-activates and
        updates the existing one.  Returns (access_instance, created_bool).
        """
        access, created = UserAgentAccess.objects.update_or_create(
            user=self._target_user,
            agent=agent,
            defaults={
                "granted_by": granted_by,
                "is_active": True,
                "expires_at": self.validated_data.get("expires_at"),
            },
        )
        return access, created


# ── User-facing serializer ────────────────────────────────────────────────────

class MyAgentSerializer(serializers.ModelSerializer):
    """
    User-facing read serializer. Exposes all display fields needed to render
    the agent card. Config is intentionally excluded.
    """
    agent_id = serializers.UUIDField(source="agent.id", read_only=True)
    name = serializers.CharField(source="agent.name", read_only=True)
    subtitle = serializers.CharField(source="agent.subtitle", read_only=True)
    description = serializers.CharField(source="agent.description", read_only=True)
    slug = serializers.SlugField(source="agent.slug", read_only=True)
    agent_type = serializers.CharField(source="agent.agent_type", read_only=True)
    status = serializers.CharField(source="agent.status", read_only=True)
    latency = serializers.CharField(source="agent.latency", read_only=True)
    efficiency = serializers.IntegerField(source="agent.efficiency", read_only=True)
    agent_is_active = serializers.BooleanField(source="agent.is_active", read_only=True)

    class Meta:
        model = UserAgentAccess
        fields = [
            "agent_id",
            "name",
            "subtitle",
            "description",
            "slug",
            "agent_type",
            "status",
            "latency",
            "efficiency",
            "agent_is_active",
            "is_active",
            "expires_at",
            "created_at",
        ]
        read_only_fields = fields
