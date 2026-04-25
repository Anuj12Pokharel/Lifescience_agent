from rest_framework import serializers

from apps.agents.models import Agent
from apps.organizations.models import (
    OrgAgentAccess,
    OrgMembership,
    Organization,
    Plan,
    UserAgentPermission,
)


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            "id", "tier", "display_name",
            "max_users", "max_agents", "price_usd_monthly",
        ]
        read_only_fields = fields


class OrganizationSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)
    owner_email = serializers.CharField(source="owner.email", read_only=True)
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Organization
        fields = [
            "id", "name", "slug", "owner_email",
            "plan", "is_active", "member_count", "created_at",
        ]
        read_only_fields = fields


class OrganizationUpdateSerializer(serializers.ModelSerializer):
    """Admin can update their org name only."""
    class Meta:
        model = Organization
        fields = ["name"]

    def update(self, instance, validated_data):
        instance.name = validated_data.get("name", instance.name)
        instance.slug = ""  # trigger slug regeneration
        instance.save()
        return instance


# ── Org Agent Access (superadmin toggle) ──────────────────────────────────────

class OrgAgentAccessSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.name", read_only=True)
    agent_slug = serializers.CharField(source="agent.slug", read_only=True)
    disabled_by_email = serializers.CharField(
        source="disabled_by.email", read_only=True, default=None
    )

    class Meta:
        model = OrgAgentAccess
        fields = [
            "id", "agent", "agent_name", "agent_slug",
            "is_enabled", "enabled_at", "disabled_by_email", "disabled_at", "notes",
        ]
        read_only_fields = [
            "id", "agent", "agent_name", "agent_slug",
            "enabled_at", "disabled_by_email", "disabled_at",
        ]


class OrgAgentToggleSerializer(serializers.Serializer):
    """Superadmin enables/disables an agent for an org."""
    is_enabled = serializers.BooleanField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def save(self, org, agent, disabled_by=None):
        from django.utils import timezone
        access, _ = OrgAgentAccess.objects.get_or_create(
            org=org, agent=agent,
            defaults={"is_enabled": True},
        )
        access.is_enabled = self.validated_data["is_enabled"]
        access.notes = self.validated_data.get("notes", "")
        if not access.is_enabled:
            access.disabled_by = disabled_by
            access.disabled_at = timezone.now()
        else:
            access.disabled_by = None
            access.disabled_at = None
        access.save()
        return access


# ── Membership ────────────────────────────────────────────────────────────────

class OrgMemberSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_id = serializers.UUIDField(source="user.id", read_only=True)

    class Meta:
        model = OrgMembership
        fields = ["id", "user_id", "user_email", "is_active", "joined_at"]
        read_only_fields = fields


# ── User Agent Permissions (admin grants per user) ────────────────────────────

class UserAgentPermissionSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = UserAgentPermission
        fields = [
            "id", "user", "user_email", "agent", "agent_name",
            "is_active", "created_at",
        ]
        read_only_fields = ["id", "user_email", "agent_name", "created_at"]


class GrantUserAgentPermissionSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    agent_id = serializers.UUIDField()

    def validate(self, attrs):
        from apps.accounts.models import CustomUser
        request = self.context["request"]
        org = request.user.owned_organization

        # Validate user belongs to this org
        try:
            user = org.memberships.select_related("user").get(
                user__id=attrs["user_id"], is_active=True
            ).user
        except OrgMembership.DoesNotExist:
            raise serializers.ValidationError(
                {"user_id": "User is not an active member of your organization."}
            )

        # Validate agent is enabled for this org
        try:
            agent = Agent.objects.get(pk=attrs["agent_id"], is_active=True)
        except Agent.DoesNotExist:
            raise serializers.ValidationError({"agent_id": "Agent not found."})

        org_access = OrgAgentAccess.objects.filter(
            org=org, agent=agent, is_enabled=True
        ).exists()
        if not org_access:
            raise serializers.ValidationError(
                {"agent_id": "This agent is not enabled for your organization."}
            )

        attrs["_user"] = user
        attrs["_agent"] = agent
        attrs["_org"] = org
        return attrs

    def save(self):
        request = self.context["request"]
        perm, created = UserAgentPermission.objects.get_or_create(
            org=self.validated_data["_org"],
            user=self.validated_data["_user"],
            agent=self.validated_data["_agent"],
            defaults={"granted_by": request.user, "is_active": True},
        )
        if not created:
            perm.is_active = True
            perm.granted_by = request.user
            perm.save(update_fields=["is_active", "granted_by"])
        return perm
