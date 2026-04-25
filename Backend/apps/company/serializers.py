from rest_framework import serializers
from apps.accounts.models import CustomUser
from .models import Company, Event


class CompanySerializer(serializers.ModelSerializer):
    managed_by_email = serializers.EmailField(source='managed_by.email', read_only=True, allow_null=True)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'id', 'name', 'location', 'website', 'email', 'timezone',
            'mission', 'pillars', 'services', 'who_we_serve', 'process',
            'system_prompt', 'managed_by', 'managed_by_email', 'can_edit',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'managed_by_email', 'can_edit']

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.can_be_edited_by(request.user)

    def validate_managed_by(self, value):
        if value is None:
            return value
        if value.role != CustomUser.Role.ADMIN:
            raise serializers.ValidationError("Only users with role 'admin' can be assigned as managers.")
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign an inactive admin as manager.")
        return value


class EventSerializer(serializers.ModelSerializer):
    managed_by_email = serializers.EmailField(source='managed_by.email', read_only=True, allow_null=True)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            'id', 'title', 'description', 'date', 'time', 'timezone',
            'format', 'is_active', 'managed_by', 'managed_by_email',
            'can_edit', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'managed_by_email', 'can_edit']

    def get_can_edit(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.can_be_edited_by(request.user)

    def validate_managed_by(self, value):
        if value is None:
            return value
        if value.role != CustomUser.Role.ADMIN:
            raise serializers.ValidationError("Only users with role 'admin' can be assigned as managers.")
        if not value.is_active:
            raise serializers.ValidationError("Cannot assign an inactive admin as manager.")
        return value
