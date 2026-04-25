#!/bin/bash
# =============================================================================
# Spoke One-Click Bootstrap — Mac Mini
# Run on: Each Mac Mini (after cloning the repo)
# Usage: SPOKE_ID=spoke-a bash deploy/spoke/spoke-init.sh
# =============================================================================

set -euo pipefail

SPOKE_ID="${SPOKE_ID:-spoke-a}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================================"
echo "  Spoke Bootstrap — $SPOKE_ID"
echo "  This script sets up a Mac Mini as an edge spoke node"
echo "========================================================"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
echo ""
echo "==> Checking prerequisites..."

command -v docker &>/dev/null || { echo "❌ Docker is not installed. Install from https://docs.docker.com/desktop/mac/install/"; exit 1; }
command -v docker compose version &>/dev/null || { echo "❌ Docker Compose V2 not found."; exit 1; }
echo "  ✅ Docker found: $(docker --version)"

# ── Environment file ──────────────────────────────────────────────────────────
echo ""
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "==> .env not found. Creating from example..."
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo ""
    echo "  ⚠️  IMPORTANT: Edit $SCRIPT_DIR/.env before continuing!"
    echo "  Set these values:"
    echo "    SPOKE_ID=$SPOKE_ID"
    echo "    HUB_TAILSCALE_IP=<hub tailscale IP>"
    echo "    REDIS_PASSWORD=<same as hub>"
    echo "    N8N_ENCRYPTION_KEY=<same as hub master>"
    echo "    CLOUDFLARE_TUNNEL_TOKEN=<from CF Zero Trust dashboard>"
    echo ""
    read -rp "Press ENTER after editing .env to continue..." _
fi

source "$SCRIPT_DIR/.env"

# ── Verify required env vars ──────────────────────────────────────────────────
echo ""
echo "==> Validating configuration..."
REQUIRED_VARS=(SPOKE_ID HUB_TAILSCALE_IP REDIS_PASSWORD N8N_ENCRYPTION_KEY CLOUDFLARE_TUNNEL_TOKEN)
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        echo "  ❌ Missing required variable: $var"
        exit 1
    fi
    echo "  ✅ $var is set"
done

# ── Tailscale setup ───────────────────────────────────────────────────────────
echo ""
echo "==> Setting up Tailscale..."
if ! command -v tailscale &>/dev/null; then
    bash "$SCRIPT_DIR/tailscale-setup.sh"
else
    echo "  ✅ Tailscale already installed"
fi

# ── Cloudflare setup ──────────────────────────────────────────────────────────
echo ""
echo "==> Verifying Cloudflare tunnel config..."
bash "$SCRIPT_DIR/cloudflared-setup.sh"

# ── Test hub connectivity ─────────────────────────────────────────────────────
echo ""
echo "==> Testing hub connectivity via Tailscale..."
if ping -c 3 "$HUB_TAILSCALE_IP" &>/dev/null; then
    echo "  ✅ Hub reachable at $HUB_TAILSCALE_IP"
else
    echo "  ⚠️  Cannot ping hub. Make sure Tailscale is running on both sides."
fi

# ── Build and start services ──────────────────────────────────────────────────
echo ""
echo "==> Building Docker images..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" build --no-cache

echo ""
echo "==> Starting spoke services..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

# ── Health check ──────────────────────────────────────────────────────────────
echo ""
echo "==> Waiting for services to be healthy..."
sleep 15

docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps

echo ""
echo "========================================================"
echo "  ✅ Spoke '$SPOKE_ID' is running!"
echo ""
echo "  Services:"
echo "    Frontend:    http://localhost:3000"
echo "    n8n Worker:  http://localhost:5679/healthz"
echo "    Tenant DB:   localhost:5434"
echo "    Chroma:      http://localhost:8010/api/v1/heartbeat"
echo ""
echo "  External access via Cloudflare Tunnel"
echo "  Check your Cloudflare Zero Trust dashboard for the URL"
echo "========================================================"
