# Hub-and-Spoke Deployment Guide

## Architecture Overview

```
                    ┌─────────────────────────────────────────┐
                    │   HUB: CONTABO SERVER (Management Plane) │
                    │                                           │
                    │  Super Admin UI ←── Git Pull             │
                    │       │                                   │
                    │  n8n MASTER ──→ REDIS ──→ dispatches jobs │
                    │  (Queue Mode)   (Broker)                  │
                    │       │                                   │
                    │  Django API ←→ PostgreSQL (Global State)  │
                    │  Celery Worker + Beat                     │
                    │  Caddy (SSL Proxy)                        │
                    └──────────────┬──────────────────────────┘
                                   │ Tailscale VPN Mesh
                    ┌──────────────┴──────────────────────────┐
                    │          SECURE CONNECTIVITY LAYER        │
                    └──────────┬────────────────────┬──────────┘
                               │                    │
          ┌────────────────────▼──┐      ┌───────────▼───────────────┐
          │  SPOKE: Mac Mini A    │      │  SPOKE: Mac Mini B        │
          │                       │      │                           │
          │  Next.js Frontend     │      │  Next.js Frontend         │
          │  n8n WORKER           │      │  n8n WORKER               │
          │  Tenant PostgreSQL    │      │  Tenant PostgreSQL        │
          │  Chroma (Vector DB)   │      │  Chroma (Vector DB)       │
          │  cloudflared (Tunnel) │      │  cloudflared (Tunnel)     │
          └───────────────────────┘      └───────────────────────────┘
                    │ Cloudflare Tunnel              │ Cloudflare Tunnel
             External Users                   External Users
```

---

## 🖥️ What Runs Where

### ✅ CONTABO SERVER (Hub)

| Service | Container | Purpose |
|---|---|---|
| Caddy | `hub-caddy` | SSL reverse proxy (Let's Encrypt) |
| PostgreSQL | `hub-postgres` | Global state + n8n state |
| Redis | `hub-redis` | Task broker for n8n queue + Celery |
| Django API | `hub-django` | REST API, Super Admin, tenant registry |
| Celery Worker | `hub-celery-worker` | Async background jobs |
| Celery Beat | `hub-celery-beat` | Scheduled tasks |
| n8n Master | `hub-n8n-master` | Workflow editor, queue dispatcher |

**Config:** `deploy/hub/`

---

### 🍎 MAC MINI NODES (Spoke — one per client location)

| Service | Container | Purpose |
|---|---|---|
| Next.js Frontend | `spoke-a-frontend` | Local UI served to users |
| n8n Worker | `spoke-a-n8n-worker` | Executes jobs pulled from hub Redis |
| PostgreSQL (Tenant) | `spoke-a-postgres` | Local client data |
| Chroma | `spoke-a-chroma` | Vector DB for local RAG |
| cloudflared | `spoke-a-cloudflared` | Exposes frontend to public via CF tunnel |

**Config:** `deploy/spoke/`

---

## 📋 Prerequisites

### Contabo Server
- Ubuntu 22.04 LTS
- Docker + Docker Compose V2
- Domain `lifescienceaiagents.com` pointing to server IP in Cloudflare DNS
- Ports open: 80, 443

### Mac Mini (each)
- macOS 13+ or Ubuntu
- Docker Desktop (Mac) or Docker Engine (Linux)
- Tailscale account
- Cloudflare Zero Trust account (free tier is fine)
- Git installed

---

## 🚀 Step 1: Setup the HUB (Contabo Server)

### 1a. Clone the repository

```bash
git clone https://github.com/YOUR_ORG/Project-Tracking-agent-.git /opt/app
cd /opt/app
```

### 1b. Install Tailscale on the Hub

```bash
bash deploy/hub/tailscale-setup.sh
```

Note the Tailscale IP shown at the end (e.g., `100.64.0.1`).

### 1c. Configure environment

```bash
cp deploy/hub/.env.example deploy/hub/.env
nano deploy/hub/.env
```

**Required values to fill in:**
- `SECRET_KEY` — Generate: `python3 -c "import secrets; print(secrets.token_hex(50))"`
- `HUB_DB_PASSWORD` — Strong password
- `REDIS_PASSWORD` — Strong password (also used by spokes)
- `N8N_ENCRYPTION_KEY` — Generate: `openssl rand -hex 32`
- `INTERNAL_API_TOKEN` — Generate: `python3 -c "import secrets; print(secrets.token_hex(32))"`

### 1d. Configure n8n Queue Mode

```bash
cp deploy/hub/n8n-queue.env deploy/hub/n8n-queue.env.local
nano deploy/hub/n8n-queue.env
```

- Set `N8N_ENCRYPTION_KEY` to the **same value** as in `.env`
- Set `N8N_BASIC_AUTH_PASSWORD` to a strong password

### 1e. Start the Hub stack

```bash
cd /opt/app
docker compose -f deploy/hub/docker-compose.yml up -d
```

### 1f. Verify Hub is running

```bash
# Check all containers are healthy
docker compose -f deploy/hub/docker-compose.yml ps

# Test Django API
curl https://api.lifescienceaiagents.com/api/v1/health/
# Expected: {"status": "ok"}

# Test n8n Master UI
# Open: https://www.lifescienceaiagents.com
```

### 1g. Create Django superuser

```bash
docker exec -it hub-django python manage.py createsuperuser
```

---

## 🍎 Step 2: Setup Each Mac Mini (Edge Spoke)

Repeat this for each Mac Mini (Location A, Location B, etc.).

### 2a. Clone the repository

```bash
git clone https://github.com/YOUR_ORG/Project-Tracking-agent-.git ~/app
cd ~/app
```

### 2b. Configure Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. **Access → Tunnels → Create a tunnel**
3. Name it `spoke-a` (or `spoke-b` for the second Mac Mini)
4. Under **"Public Hostname"**:
   - Subdomain: `client-a`
   - Domain: `lifescienceaiagents.com`
   - Service: `http://frontend:3000`
5. Copy the **Tunnel Token** shown

### 2c. Configure environment

```bash
cp deploy/spoke/.env.example deploy/spoke/.env
nano deploy/spoke/.env
```

**Required values:**
- `SPOKE_ID` — `spoke-a` (change to `spoke-b` for second Mac Mini)
- `HUB_TAILSCALE_IP` — Tailscale IP of the Contabo server from Step 1b
- `REDIS_PASSWORD` — **Same value** as hub's `REDIS_PASSWORD`
- `N8N_ENCRYPTION_KEY` — **Same value** as hub's `N8N_ENCRYPTION_KEY`
- `CLOUDFLARE_TUNNEL_TOKEN` — Token from Step 2b

### 2d. Run spoke bootstrap

```bash
SPOKE_ID=spoke-a bash deploy/spoke/spoke-init.sh
```

This will:
1. Install Tailscale and join the mesh
2. Verify Cloudflare tunnel token
3. Build all Docker images
4. Start all services

### 2e. Register spoke with Hub

After the spoke is running, register it with the hub:

```bash
curl -X POST https://api.lifescienceaiagents.com/internal/spokes/register/ \
  -H "Content-Type: application/json" \
  -H "Authorization: InternalToken YOUR_INTERNAL_API_TOKEN" \
  -d '{
    "spoke_id": "spoke-a",
    "name": "Location A - Mac Mini",
    "tailscale_ip": "100.x.x.x",
    "cloudflare_hostname": "client-a.lifescienceaiagents.com",
    "n8n_worker_url": "http://n8n-worker:5679",
    "n8n_worker_pool": "company_a",
    "version": "1.0.0"
  }'
```

### 2f. Verify spoke is running

```bash
# Local services
curl http://localhost:3000          # Frontend
curl http://localhost:5679/healthz  # n8n worker
curl http://localhost:8010/api/v1/heartbeat  # Chroma

# External via Cloudflare Tunnel
curl https://client-a.lifescienceaiagents.com

# n8n worker pulled into the queue
# Check Hub n8n UI: www.lifescienceaiagents.com → Workers tab
```

---

## 🔒 Step 3: Verify Connectivity

### Tailscale mesh connectivity (from each spoke)

```bash
# Ping hub
ping $(grep HUB_TAILSCALE_IP deploy/spoke/.env | cut -d= -f2)

# Test Redis on hub
redis-cli -h HUB_TAILSCALE_IP -a REDIS_PASSWORD ping
# Expected: PONG

# Test PostgreSQL on hub
psql -h HUB_TAILSCALE_IP -U hub_user -d app_db -c "SELECT 1;"
```

### n8n Queue Mode Verification

1. Open `https://www.lifescienceaiagents.com` (n8n Master UI)
2. Go to **Settings → Workers**
3. You should see your spoke workers listed as "Active"
4. Create a test workflow and execute it — it should run on the spoke worker

---

## 🔄 Spoke Heartbeat Setup (Cron)

Set up a cron job on each Mac Mini to send heartbeats:

```bash
# Add to crontab (crontab -e)
*/2 * * * * curl -s -X POST https://api.lifescienceaiagents.com/internal/spokes/spoke-a/heartbeat/ \
  -H "Content-Type: application/json" \
  -H "Authorization: InternalToken YOUR_INTERNAL_API_TOKEN" \
  -d '{"spoke_id": "spoke-a", "status": "online", "version": "1.0.0"}' \
  > /dev/null 2>&1
```

---

## 📊 Monitoring

### View spoke status from Hub

```bash
curl https://api.lifescienceaiagents.com/internal/spokes/ \
  -H "Authorization: InternalToken YOUR_INTERNAL_API_TOKEN"
```

### View container logs

```bash
# Hub
docker compose -f deploy/hub/docker-compose.yml logs -f n8n-master
docker compose -f deploy/hub/docker-compose.yml logs -f django-api

# Spoke (on Mac Mini)
docker compose -f deploy/spoke/docker-compose.yml logs -f n8n-worker
docker compose -f deploy/spoke/docker-compose.yml logs -f cloudflared
```

---

## 🔑 Secrets Quick Reference

| Secret | Where | Must Match Between |
|---|---|---|
| `N8N_ENCRYPTION_KEY` | hub `.env` + `n8n-queue.env` + spoke `.env` | ALL |
| `REDIS_PASSWORD` | hub `.env` + spoke `.env` | Hub + All Spokes |
| `INTERNAL_API_TOKEN` | hub `.env` | Hub only (spokes send it in headers) |
| `SECRET_KEY` | hub `.env` | Hub only |
| `HUB_DB_PASSWORD` | hub `.env` | Hub only |
| `TENANT_DB_PASSWORD` | spoke `.env` | Per-spoke (can differ) |
| `CLOUDFLARE_TUNNEL_TOKEN` | spoke `.env` | Per-spoke (different per location) |

---

## ❓ Troubleshooting

| Problem | Solution |
|---|---|
| n8n worker not connecting to Redis | Check `HUB_TAILSCALE_IP` in spoke `.env`; verify Tailscale running |
| Cloudflare tunnel offline | Check `CLOUDFLARE_TUNNEL_TOKEN` in spoke `.env`; check Zero Trust dashboard |
| Frontend 502 Bad Gateway | Frontend container not running; check `docker compose ps` on spoke |
| Django migrations fail | Run `docker exec -it hub-django python manage.py migrate` |
| Redis AUTH error | Verify `REDIS_PASSWORD` matches between hub and all spoke `.env` files |
| n8n workflows not running on spoke | Verify `EXECUTIONS_MODE=worker` in `n8n-worker.env` |
