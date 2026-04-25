"""
Spoke Node Views — Internal API (token-authenticated, no JWT required)
Called by edge spoke nodes during registration, heartbeat, and config fetch.
"""

import logging
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from .spoke_models import SpokeNode
from .spoke_serializers import (
    SpokeNodeSerializer,
    SpokeRegisterSerializer,
    SpokeHeartbeatSerializer,
)

logger = logging.getLogger(__name__)


def _verify_internal_token(request):
    """
    Verify the internal API token shared between hub and spokes.
    Token is passed as: Authorization: InternalToken <token>
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("InternalToken "):
        return False
    token = auth_header.split(" ", 1)[1].strip()
    return token == getattr(settings, "INTERNAL_API_TOKEN", "")


class SpokeListView(APIView):
    """
    GET /internal/spokes/ — List all registered spoke nodes
    Restricted to hub-internal use (requires internal token).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if not _verify_internal_token(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        spokes = SpokeNode.objects.all()
        serializer = SpokeNodeSerializer(spokes, many=True)
        return Response({
            "count": spokes.count(),
            "results": serializer.data,
        })


class SpokeRegisterView(APIView):
    """
    POST /internal/spokes/register — Spoke self-registers or updates its config.

    Called by deploy/spoke/spoke-init.sh on startup.
    Creates or updates the spoke record and marks it ONLINE.

    Request body:
    {
        "spoke_id": "spoke-a",
        "name": "Location A - Mac Mini",
        "tailscale_ip": "100.x.x.x",
        "cloudflare_hostname": "client-a.lifescienceaiagents.com",
        "n8n_worker_url": "http://n8n-worker:5679",
        "n8n_worker_pool": "company_a",
        "version": "1.0.0"
    }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if not _verify_internal_token(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = SpokeRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        spoke = serializer.save()
        logger.info(f"Spoke registered: {spoke.spoke_id} from {spoke.tailscale_ip}")

        return Response(
            {
                "message": f"Spoke '{spoke.spoke_id}' registered successfully.",
                "spoke": SpokeNodeSerializer(spoke).data,
            },
            status=status.HTTP_200_OK,
        )


class SpokeDetailView(APIView):
    """
    GET /internal/spokes/<spoke_id>/ — Get spoke config
    Used by n8n workers and spoke frontends to fetch their config from hub.
    """
    permission_classes = [AllowAny]

    def get(self, request, spoke_id):
        if not _verify_internal_token(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            spoke = SpokeNode.objects.get(spoke_id=spoke_id)
        except SpokeNode.DoesNotExist:
            return Response({"error": f"Spoke '{spoke_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SpokeNodeSerializer(spoke)
        return Response(serializer.data)

    def delete(self, request, spoke_id):
        """
        DELETE /internal/spokes/<spoke_id>/ — Deregister a spoke (mark offline)
        """
        if not _verify_internal_token(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            spoke = SpokeNode.objects.get(spoke_id=spoke_id)
        except SpokeNode.DoesNotExist:
            return Response({"error": f"Spoke '{spoke_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        spoke.mark_offline()
        logger.info(f"Spoke deregistered: {spoke_id}")
        return Response({"message": f"Spoke '{spoke_id}' marked offline."})


class SpokeHeartbeatView(APIView):
    """
    POST /internal/spokes/<spoke_id>/heartbeat — Periodic health ping from spoke.
    Updates last_heartbeat timestamp and status.
    """
    permission_classes = [AllowAny]

    def post(self, request, spoke_id):
        if not _verify_internal_token(request):
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            spoke = SpokeNode.objects.get(spoke_id=spoke_id)
        except SpokeNode.DoesNotExist:
            return Response({"error": f"Spoke '{spoke_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SpokeHeartbeatSerializer(data=request.data)
        if serializer.is_valid():
            new_status = serializer.validated_data.get("status", SpokeNode.STATUS_ONLINE)
            spoke.status = new_status
            spoke.last_heartbeat = timezone.now()
            if serializer.validated_data.get("version"):
                spoke.version = serializer.validated_data["version"]
            spoke.save(update_fields=["status", "last_heartbeat", "version", "updated_at"])

        return Response({
            "spoke_id": spoke_id,
            "status": spoke.status,
            "last_heartbeat": spoke.last_heartbeat,
        })
