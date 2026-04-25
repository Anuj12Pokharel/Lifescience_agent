from rest_framework import serializers
from apps.agents.models import Agent
from apps.integrations.models import AgentIntegrationProvider


class IntegrationProviderWriteSerializer(serializers.ModelSerializer):
    """Superadmin creates/updates an integration provider for an agent."""

    class Meta:
        model = AgentIntegrationProvider
        fields = [
            "id", "agent", "provider", "display_name", "logo_url",
            "auth_type", "oauth_config", "field_schema", "is_active",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        auth_type = attrs.get("auth_type", self.instance.auth_type if self.instance else None)

        if auth_type == AgentIntegrationProvider.AuthType.OAUTH2:
            cfg = attrs.get("oauth_config", {})
            required = ["auth_url", "token_url", "scopes", "client_id_setting", "client_secret_setting"]
            missing = [k for k in required if not cfg.get(k)]
            if missing:
                raise serializers.ValidationError(
                    {"oauth_config": f"Missing required OAuth2 keys: {', '.join(missing)}"}
                )

        if auth_type == AgentIntegrationProvider.AuthType.APIKEY:
            schema = attrs.get("field_schema", [])
            if not schema:
                raise serializers.ValidationError(
                    {"field_schema": "API key providers must define at least one field in field_schema."}
                )

        return attrs
