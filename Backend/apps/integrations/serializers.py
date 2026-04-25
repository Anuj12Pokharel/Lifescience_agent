from rest_framework import serializers

from apps.integrations.models import AgentIntegrationProvider, OrgIntegrationCredential


class AgentIntegrationProviderSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.name", read_only=True)

    class Meta:
        model = AgentIntegrationProvider
        fields = [
            "id", "agent", "agent_name", "provider", "display_name",
            "logo_url", "auth_type", "field_schema", "is_active",
        ]
        read_only_fields = ["id", "agent_name"]


class OrgCredentialSerializer(serializers.ModelSerializer):
    """
    Safe read representation — never exposes raw tokens.
    Shows connection status and metadata only.
    """
    provider_name = serializers.CharField(source="provider.display_name", read_only=True)
    provider_slug = serializers.CharField(source="provider.provider", read_only=True)
    agent_name = serializers.CharField(source="provider.agent.name", read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    connected_by_email = serializers.CharField(
        source="connected_by.email", read_only=True, default=None
    )

    class Meta:
        model = OrgIntegrationCredential
        fields = [
            "id", "provider", "provider_name", "provider_slug", "agent_name",
            "is_active", "is_expired", "token_expiry",
            "connected_by_email", "created_at", "updated_at",
        ]
        read_only_fields = fields


class ApiKeyConnectSerializer(serializers.Serializer):
    """
    For providers that use auth_type=apikey.
    Accepts arbitrary key-value pairs matching the provider's field_schema.
    """
    provider_id = serializers.UUIDField()
    credentials = serializers.DictField(child=serializers.CharField())

    def validate(self, attrs):
        try:
            provider = AgentIntegrationProvider.objects.select_related("agent").get(
                pk=attrs["provider_id"],
                auth_type=AgentIntegrationProvider.AuthType.APIKEY,
                is_active=True,
            )
        except AgentIntegrationProvider.DoesNotExist:
            raise serializers.ValidationError(
                {"provider_id": "Provider not found or does not support API key auth."}
            )

        # Validate required fields from schema
        required_fields = [f["name"] for f in provider.field_schema if not f.get("optional")]
        missing = [f for f in required_fields if f not in attrs["credentials"]]
        if missing:
            raise serializers.ValidationError(
                {"credentials": f"Missing required fields: {', '.join(missing)}"}
            )

        attrs["_provider"] = provider
        return attrs

    def save(self, org, connected_by):
        import json
        from apps.integrations.encryption import encrypt

        provider = self.validated_data["_provider"]
        cred_data = self.validated_data["credentials"]

        credential, _ = OrgIntegrationCredential.objects.get_or_create(
            org=org,
            provider=provider,
            defaults={"connected_by": connected_by},
        )
        credential.connected_by = connected_by
        credential.is_active = True
        credential.access_token = ""
        credential.refresh_token = ""
        credential.token_expiry = None
        # Store all apikey fields as encrypted extra_data
        credential.set_extra_data(cred_data)
        credential.save()
        return credential
