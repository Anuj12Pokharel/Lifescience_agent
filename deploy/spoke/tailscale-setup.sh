#!/bin/bash
# =============================================================================
# Tailscale Setup — Edge Spoke (Mac Mini)
# Run on: Each Mac Mini
# =============================================================================

set -euo pipefail

echo "================================================"
echo "  Tailscale Setup — Mac Mini Edge Spoke"
echo "================================================"

OS_TYPE="$(uname -s)"

# ── Install Tailscale ─────────────────────────────────────────────────────────
echo ""
echo "==> Installing Tailscale..."

if [ "$OS_TYPE" = "Darwin" ]; then
    # macOS — prefer App Store but also support CLI
    if command -v brew &>/dev/null; then
        brew install tailscale
    else
        echo "Please install Tailscale from: https://tailscale.com/download/mac"
        echo "Or install Homebrew first: https://brew.sh"
        exit 1
    fi
elif [ "$OS_TYPE" = "Linux" ]; then
    curl -fsSL https://tailscale.com/install.sh | sh
fi

echo "  ✅ Tailscale installed"

# ── Start Tailscale ───────────────────────────────────────────────────────────
echo ""
echo "==> Starting Tailscale..."

if [ "$OS_TYPE" = "Darwin" ]; then
    # Start Tailscale on macOS (runs as a system service after install)
    open -a Tailscale || true
    sleep 2
elif [ "$OS_TYPE" = "Linux" ]; then
    systemctl enable tailscaled
    systemctl start tailscaled
fi

# ── Authenticate ──────────────────────────────────────────────────────────────
echo ""
echo "==> Authenticating this spoke with Tailscale..."
echo "    Get a pre-auth key from:"
echo "    https://login.tailscale.com/admin/settings/keys"
echo "    (Create a reusable key tagged 'spoke')"
echo ""

if [ -z "${TS_AUTHKEY:-}" ]; then
    read -rsp "Enter your Tailscale Auth Key: " TS_AUTHKEY
    echo ""
fi

SPOKE_ID="${SPOKE_ID:-spoke-a}"

tailscale up \
    --authkey="$TS_AUTHKEY" \
    --hostname="$SPOKE_ID-mac-mini" \
    --accept-routes \
    --ssh

# ── Show results ──────────────────────────────────────────────────────────────
echo ""
SPOKE_TS_IP=$(tailscale ip -4)
echo "================================================"
echo "  ✅ Tailscale connected!"
echo ""
echo "  Spoke Tailscale IP: $SPOKE_TS_IP"
echo "  Spoke Hostname:     $SPOKE_ID-mac-mini"
echo ""
echo "  This spoke can now reach the hub via Tailscale."
echo ""
echo "  Verify hub connectivity:"
echo "    ping \$HUB_TAILSCALE_IP"
echo "    redis-cli -h \$HUB_TAILSCALE_IP -a \$REDIS_PASSWORD ping"
echo "================================================"
