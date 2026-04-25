#!/bin/bash
# =============================================================================
# Tailscale Setup — HUB (Contabo Server)
# Run as root on: Contabo Server
# =============================================================================

set -euo pipefail

echo "=========================================="
echo "  Tailscale Setup — HUB (Contabo Server)"
echo "=========================================="

# ── Install Tailscale ─────────────────────────────────────────────────────────
echo ""
echo "==> Installing Tailscale..."
curl -fsSL https://tailscale.com/install.sh | sh

# ── Enable IP forwarding (required for subnet routing) ────────────────────────
echo "==> Enabling IP forwarding..."
echo 'net.ipv4.ip_forward = 1' | tee -a /etc/sysctl.d/99-tailscale.conf
echo 'net.ipv6.conf.all.forwarding = 1' | tee -a /etc/sysctl.d/99-tailscale.conf
sysctl -p /etc/sysctl.d/99-tailscale.conf

# ── Start Tailscale daemon ────────────────────────────────────────────────────
echo "==> Starting Tailscale daemon..."
systemctl enable tailscaled
systemctl start tailscaled

# ── Authenticate ──────────────────────────────────────────────────────────────
echo ""
echo "==> Authenticating with Tailscale..."
echo "    You need a Tailscale Auth Key from:"
echo "    https://login.tailscale.com/admin/settings/keys"
echo ""

if [ -z "${TS_AUTHKEY:-}" ]; then
    read -rsp "Enter your Tailscale Auth Key: " TS_AUTHKEY
    echo ""
fi

# Join the tailnet and advertise the Docker hub-net subnet
tailscale up \
    --authkey="$TS_AUTHKEY" \
    --advertise-routes=172.20.0.0/16 \
    --hostname=hub-contabo \
    --accept-routes \
    --ssh

# ── Get Tailscale IP ──────────────────────────────────────────────────────────
echo ""
echo "==> Tailscale setup complete!"
HUB_TS_IP=$(tailscale ip -4)
echo ""
echo "  ✅ Hub Tailscale IP: $HUB_TS_IP"
echo ""
echo "  IMPORTANT: Add this to deploy/hub/.env:"
echo "    TAILSCALE_HUB_IP=$HUB_TS_IP"
echo ""
echo "  IMPORTANT: Add this to deploy/spoke/.env on each Mac Mini:"
echo "    HUB_TAILSCALE_IP=$HUB_TS_IP"
echo "    REDIS_URL=redis://:<REDIS_PASSWORD>@$HUB_TS_IP:6379/0"
echo "    N8N_QUEUE_BULL_REDIS_HOST=$HUB_TS_IP"
echo ""
echo "  The n8n workers and spoke databases connect to the hub via:"
echo "    Redis:      $HUB_TS_IP:6379"
echo "    PostgreSQL: $HUB_TS_IP:5432"
echo "=========================================="
