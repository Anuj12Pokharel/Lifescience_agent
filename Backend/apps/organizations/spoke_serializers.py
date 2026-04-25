"""
Spoke Node Serializers
"""
from rest_framework import serializers
from .spoke_models import SpokeNode


class SpokeNodeSerializer(serializers.ModelSerializer):
    is_online = serializers.ReadOnlyField()
    is_stale = serializers.ReadOnlyField()

    class Meta:
        model = SpokeNode
        fields = [
            "id",
            "spoke_id",
            "name",
            "tailscale_ip",
            "cloudflare_hostname",
            "company",
            "n8n_worker_url",
            "n8n_worker_pool",
            "status",
            "last_heartbeat",
            "version",
            "is_online",
            "is_stale",
            "registered_at",
            "updated_at",
        ]
        read_only_fields = ["id", "registered_at", "updated_at", "status", "last_heartbeat"]


class SpokeRegisterSerializer(serializers.ModelSerializer):
    """
    Used by a spoke node to self-register or update its config on the hub.
    Called from deploy/spoke/spoke-init.sh via POST /internal/spokes/register
    """

    class Meta:
        model = SpokeNode
        fields = [
            "spoke_id",
            "name",
            "tailscale_ip",
            "cloudflare_hostname",
            "n8n_worker_url",
            "n8n_worker_pool",
            "version",
        ]

    def create(self, validated_data):
        spoke, created = SpokeNode.objects.update_or_create(
            spoke_id=validated_data["spoke_id"],
            defaults={
                **validated_data,
                "status": SpokeNode.STATUS_ONLINE,
            },
        )
        from django.utils import timezone
        spoke.last_heartbeat = timezone.now()
        spoke.save(update_fields=["last_heartbeat"])
        return spoke


class SpokeHeartbeatSerializer(serializers.Serializer):
    """Lightweight heartbeat payload sent periodically by each spoke."""
    spoke_id = serializers.SlugField()
    status = serializers.ChoiceField(
        choices=SpokeNode.STATUS_CHOICES,
        default=SpokeNode.STATUS_ONLINE,
    )
    version = serializers.CharField(max_length=32, required=False, allow_blank=True)
