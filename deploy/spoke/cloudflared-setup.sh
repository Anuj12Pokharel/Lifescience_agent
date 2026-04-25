#!/bin/bash
# =============================================================================
# Cloudflare Tunnel Setup — Edge Spoke (Mac Mini)
# Run on: Each Mac Mini
# =============================================================================
# Prerequisites:
#   1. Create a tunnel at https://one.dash.cloudflare.com > Access > Tunnels
#   2. Name it e.g. "spoke-a" or "spoke-b"
#   3. Set route: your-hostname → http://frontend:3000
#   4. Copy the tunnel token into deploy/spoke/.env as CLOUDFLARE_TUNNEL_TOKEN
# =============================================================================

set -euo pipefail

echo "=============================================="
echo "  Cloudflare Tunnel Setup — Mac Mini Spoke"
echo "=============================================="

OS_TYPE="$(uname -s)"

# ── Install cloudflared ────────────────────────────────────────────────────────
echo ""
echo "==> Installing cloudflared..."

if [ "$OS_TYPE" = "Darwin" ]; then
    # macOS
    if command -v brew &>/dev/null; then
        brew install cloudflare/cloudflare/cloudflared
    else
        echo "Homebrew not found. Installing manually..."
        curl -Lo cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64
        chmod +x cloudflared
        sudo mv cloudflared /usr/local/bin/
    fi
elif [ "$OS_TYPE" = "Linux" ]; then
    # Linux (Ubuntu/Debian)
    curl -Lo cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

echo "  ✅ cloudflared installed: $(cloudflared --version)"

# ── Verify token is set ────────────────────────────────────────────────────────
echo ""
if [ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
    echo "  CLOUDFLARE_TUNNEL_TOKEN is not set."
    echo "  Get your token from:"
    echo "    1. https://one.dash.cloudflare.com"
    echo "    2. Access > Tunnels > Select your tunnel"
    echo "    3. Copy the token"
    read -rsp "  Enter your Cloudflare Tunnel Token: " CLOUDFLARE_TUNNEL_TOKEN
    echo ""
fi

# ── Test tunnel connection ─────────────────────────────────────────────────────
echo ""
echo "==> Testing tunnel token..."
cloudflared tunnel --token "$CLOUDFLARE_TUNNEL_TOKEN" --test-run 2>/dev/null && \
    echo "  ✅ Tunnel token is valid!" || \
    echo "  ⚠️  Could not verify token (this may be normal if docker isn't up yet)"

# ── Instructions ──────────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  Cloudflare Tunnel is handled by Docker."
echo ""
echo "  The 'cloudflared' container in docker-compose.yml"
echo "  will automatically use your CLOUDFLARE_TUNNEL_TOKEN."
echo ""
echo "  Make sure in your Cloudflare Zero Trust dashboard:"
echo "    Tunnel Route: <your-hostname> → http://frontend:3000"
echo ""
echo "  Once docker compose is up, test at:"
echo "    https://<your-configured-hostname>"
echo "=============================================="
