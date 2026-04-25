#!/bin/bash
# ============================================================
# n8n Auto-Setup Script for Hostinger Ubuntu VPS
# Server IP: 148.135.137.3
# Run as root: bash setup.sh
# ============================================================

set -e

echo "==> Updating system..."
apt update && apt upgrade -y
apt install -y curl ufw

echo "==> Configuring firewall..."
ufw allow OpenSSH
ufw allow 5678
ufw --force enable

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

echo "==> Creating n8n directory..."
mkdir -p /opt/n8n
cd /opt/n8n

echo "==> Generating encryption key..."
ENC_KEY=$(openssl rand -hex 32)
echo "Your encryption key: $ENC_KEY"
echo "SAVE THIS KEY SOMEWHERE SAFE!"

echo "==> Writing docker-compose.yml..."
cat > docker-compose.yml <<EOF
version: "3.8"

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=148.135.137.3
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://148.135.137.3:5678/
      - N8N_ENCRYPTION_KEY=${ENC_KEY}
      - GENERIC_TIMEZONE=Asia/Kathmandu
      - N8N_LOG_LEVEL=info
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
    driver: local
EOF

echo "==> Starting n8n..."
docker compose up -d

echo ""
echo "============================================"
echo "  n8n is running!"
echo "  Open: http://148.135.137.3:5678"
echo "  Encryption key saved in docker-compose.yml"
echo "============================================"
