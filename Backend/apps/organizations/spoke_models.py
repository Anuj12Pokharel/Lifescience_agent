"""
Spoke Node Registration Models
Tracks registered Mac Mini edge nodes and their configuration.
"""

import uuid
from django.db import models
from django.utils import timezone


class SpokeNode(models.Model):
    """
    Represents an Edge Spoke (Mac Mini) registered with the Hub.

    Each spoke registers itself on startup and the hub records:
    - Its Tailscale IP (for private control plane communication)
    - Its Cloudflare tunnel hostname (for public user access)
    - Which company/tenant it serves
    - Its current health status
    """

    STATUS_ONLINE = "online"
    STATUS_OFFLINE = "offline"
    STATUS_DEGRADED = "degraded"

    STATUS_CHOICES = [
        (STATUS_ONLINE, "Online"),
        (STATUS_OFFLINE, "Offline"),
        (STATUS_DEGRADED, "Degraded"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spoke_id = models.SlugField(
        unique=True,
        max_length=64,
        help_text="Unique slug for this spoke, e.g. 'spoke-a', 'spoke-b'",
    )
    name = models.CharField(max_length=128, help_text="Human-readable name, e.g. 'Location A - Mac Mini'")

    # Network
    tailscale_ip = models.GenericIPAddressField(
        null=True, blank=True,
        help_text="Private Tailscale IP (used for control plane)"
    )
    cloudflare_hostname = models.CharField(
        max_length=255, blank=True,
        help_text="Public Cloudflare tunnel hostname for this spoke's frontend"
    )

    # Tenant association (optional — one spoke can serve one or more companies)
    company = models.ForeignKey(
        "company.Company",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="spokes",
        help_text="Primary company/tenant served by this spoke"
    )

    # n8n worker info
    n8n_worker_url = models.CharField(
        max_length=255, blank=True,
        help_text="Local n8n worker URL, e.g. http://n8n-worker:5679"
    )
    n8n_worker_pool = models.CharField(
        max_length=128, blank=True,
        help_text="n8n worker queue pool name, e.g. 'company_a'"
    )

    # Status
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_OFFLINE)
    last_heartbeat = models.DateTimeField(null=True, blank=True)

    # Metadata
    version = models.CharField(max_length=32, blank=True, help_text="App version running on spoke")
    registered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations_spoke_node"
        ordering = ["spoke_id"]
        verbose_name = "Spoke Node"
        verbose_name_plural = "Spoke Nodes"

    def __str__(self):
        return f"{self.name} ({self.spoke_id}) — {self.status}"

    def mark_online(self):
        self.status = self.STATUS_ONLINE
        self.last_heartbeat = timezone.now()
        self.save(update_fields=["status", "last_heartbeat", "updated_at"])

    def mark_offline(self):
        self.status = self.STATUS_OFFLINE
        self.save(update_fields=["status", "updated_at"])

    @property
    def is_online(self):
        return self.status == self.STATUS_ONLINE

    @property
    def is_stale(self):
        """Returns True if no heartbeat in last 5 minutes."""
        if not self.last_heartbeat:
            return True
        return (timezone.now() - self.last_heartbeat).total_seconds() > 300
