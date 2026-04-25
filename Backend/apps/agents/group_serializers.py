from rest_framework import serializers

from apps.accounts.models import CustomUser
from apps.agents.group_models import AgentGroup, AgentGroupAccess, AgentGroupMembership
from apps.agents.models import Agent


class GroupMemberSerializer(serializers.ModelSerializer):
    """Lightweight user info embedded in group responses."""
    class Meta:
        model = CustomUser
        fields = ["id", "email", "role", "is_active"]
        read_only_fields = fields


class GroupAgentSerializer(serializers.ModelSerializer):
    """Lightweight agent info embedded in group responses."""
    class Meta:
        model = Agent
        fields = ["id", "name", "subtitle", "slug", "agent_type", "status", "is_active"]
        read_only_fields = fields


# ── Group ─────────────────────────────────────────────────────────────────────

class AgentGroupSerializer(serializers.ModelSerializer):
    """Read serializer — includes member count and agent count."""
    member_count = serializers.SerializerMethodField()
    agent_count = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = AgentGroup
        fields = [
            "id", "name", "description", "is_active",
            "member_count", "agent_count", "created_by",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_member_count(self, obj):
        return obj.memberships.filter(is_active=True).count()

    def get_agent_count(self, obj):
        return obj.agent_accesses.filter(is_active=True).count()

    def get_created_by(self, obj):
        return obj.created_by.email if obj.created_by else None


class AgentGroupWriteSerializer(serializers.Serializer):
    """Write serializer for create/update group."""
    name = serializers.CharField(max_length=150)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    is_active = serializers.BooleanField(required=False, default=True)

    def validate_name(self, value):
        qs = AgentGroup.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A group with this name already exists.")
        return value

    def create(self, validated_data):
        return AgentGroup.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


# ── Group detail (members + agents) ──────────────────────────────────────────

class AgentGroupDetailSerializer(serializers.ModelSerializer):
    """Full detail: includes member list and agent list."""
    members = serializers.SerializerMethodField()
    agents = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = AgentGroup
        fields = [
            "id", "name", "description", "is_active",
            "members", "agents", "created_by",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_members(self, obj):
        memberships = obj.memberships.filter(is_active=True).select_related("user")
        return [
            {
                "membership_id": str(m.id),
                "user_id": str(m.user.id),
                "email": m.user.email,
                "role": m.user.role,
                "is_active": m.is_active,
                "added_by": m.added_by.email if m.added_by else None,
                "joined_at": m.created_at,
            }
            for m in memberships
        ]

    def get_agents(self, obj):
        accesses = obj.agent_accesses.filter(is_active=True).select_related("agent")
        return [
            {
                "access_id": str(a.id),
                "agent_id": str(a.agent.id),
                "name": a.agent.name,
                "subtitle": a.agent.subtitle,
                "slug": a.agent.slug,
                "agent_type": a.agent.agent_type,
                "status": a.agent.status,
                "agent_is_active": a.agent.is_active,
                "granted_by": a.granted_by.email if a.granted_by else None,
                "granted_at": a.created_at,
            }
            for a in accesses
        ]

    def get_created_by(self, obj):
        return obj.created_by.email if obj.created_by else None


# ── Membership ────────────────────────────────────────────────────────────────

class AddMembersSerializer(serializers.Serializer):
    """
    Add one or multiple users to a group.
    Body: { "user_ids": ["uuid", "uuid", ...] }
    """
    user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
    )

    def validate_user_ids(self, value):
        found = CustomUser.objects.filter(pk__in=value, is_active=True)
        found_ids = set(str(u.id) for u in found)
        missing = [str(uid) for uid in value if str(uid) not in found_ids]
        if missing:
            raise serializers.ValidationError(
                f"Users not found or inactive: {', '.join(missing)}"
            )
        self._users = list(found)
        return value

    def save(self, *, group: AgentGroup, added_by: CustomUser) -> dict:
        created_count = 0
        reactivated_count = 0
        for user in self._users:
            membership, created = AgentGroupMembership.objects.get_or_create(
                group=group,
                user=user,
                defaults={"added_by": added_by, "is_active": True},
            )
            if created:
                created_count += 1
            elif not membership.is_active:
                membership.is_active = True
                membership.added_by = added_by
                membership.save(update_fields=["is_active", "added_by", "updated_at"])
                reactivated_count += 1
        return {"added": created_count, "reactivated": reactivated_count}


class RemoveMemberSerializer(serializers.Serializer):
    """
    Soft-remove a user from a group (sets is_active=False).
    The membership record is kept for audit.
    """
    def save(self, *, group: AgentGroup, user_id) -> AgentGroupMembership:
        try:
            membership = AgentGroupMembership.objects.get(group=group, user__id=user_id)
        except AgentGroupMembership.DoesNotExist:
            raise serializers.ValidationError("This user is not a member of the group.")
        membership.is_active = False
        membership.save(update_fields=["is_active", "updated_at"])
        return membership


# ── Group Agent Access ────────────────────────────────────────────────────────

class AddGroupAgentsSerializer(serializers.Serializer):
    """
    Assign one or multiple agents to a group.
    Body: { "agent_ids": ["uuid", "uuid", ...] }
    """
    agent_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
    )

    def validate_agent_ids(self, value):
        found = Agent.objects.filter(pk__in=value)
        found_ids = set(str(a.id) for a in found)
        missing = [str(aid) for aid in value if str(aid) not in found_ids]
        if missing:
            raise serializers.ValidationError(
                f"Agents not found: {', '.join(missing)}"
            )
        self._agents = list(found)
        return value

    def save(self, *, group: AgentGroup, granted_by: CustomUser) -> dict:
        created_count = 0
        reactivated_count = 0
        for agent in self._agents:
            access, created = AgentGroupAccess.objects.get_or_create(
                group=group,
                agent=agent,
                defaults={"granted_by": granted_by, "is_active": True},
            )
            if created:
                created_count += 1
            elif not access.is_active:
                access.is_active = True
                access.granted_by = granted_by
                access.save(update_fields=["is_active", "granted_by", "updated_at"])
                reactivated_count += 1
        return {"added": created_count, "reactivated": reactivated_count}
