# Master Setup Guide: True Hybrid Architecture

This guide covers the end-to-end deployment of your distributed "Cloud Compute, Edge Storage" AI application.

## 🏗️ Architecture Overview

Your application is split into two physical locations to maximize speed while maintaining strict data privacy.

**1. The Hub (Contabo Server in Germany)**
*Acts as the "Compute Brain" and Fast Database.*
* **Caddy:** Reverse Proxy routing traffic to `ai.lifescienceaiagents.com`.
* **Frontend (Next.js):** The website UI.
* **Backend (Django):** The core API logic.
* **PostgreSQL:** Fast relational database for User Accounts and App State.
* **n8n Master:** The AI Workflow Engine.
* **Redis & Celery:** Background task queues.

**2. The Spoke (Mac Mini in your Office)**
*Acts as the "Heavy Storage Array".*
* **Chroma:** Vector Database. Stores the "memories" and embeddings of your AI agents locally.
* **MinIO:** S3-Compatible Object Storage. Stores all physical files, PDFs, and uploaded images locally.
* **Cloudflared:** Securely connects your local storage to the global internet so the Frontend can load your images.

---

## 🚀 Step 1: Pre-Requisites

1. **Tailscale:** Ensure Tailscale is installed on both Contabo and the Mac Mini, and both are logged into the same Tailnet.
   - Run `tailscale ip -4` on your Mac Mini to get its IP address. Save this for Step 4.
2. **Cloudflare:** Ensure your domain (`lifescienceaiagents.com`) is Active in Cloudflare.
3. **Cloudflare Tunnel:** Ensure you have created a Tunnel in the Cloudflare Zero Trust Dashboard and have the Token ready.

---

## 🧹 Step 2: Clean Up Old Deployments

Before launching the new architecture, destroy any old containers to prevent port conflicts.

**On the Contabo Server:**
```bash
cd ~/Lifescience_agent/deploy/hub
docker compose down
```

**On the Mac Mini:**
```bash
cd ~/Lifescience_agent/deploy/spoke
docker compose down
```

---

## 💾 Step 3: Deploy the Mac Mini (Storage Plane)

1. **Navigate to the Spoke folder:**
   ```bash
   cd ~/Lifescience_agent/deploy/spoke
   ```
2. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   * Fill in `MINIO_ROOT_PASSWORD` (make up a strong password).
   * Fill in `CLOUDFLARE_TUNNEL_TOKEN`.
3. **Start the Storage Array:**
   ```bash
   docker compose up -d
   ```
4. **Configure the Cloudflare Storage Route:**
   * Go to your Cloudflare Zero Trust Dashboard -> Tunnels -> Configure.
   * Modify or add a Public Hostname: `storage.lifescienceaiagents.com` -> `http://minio:9000`

---

## 🧠 Step 4: Deploy the Contabo Server (Compute Plane)

1. **Navigate to the Hub folder:**
   ```bash
   cd ~/Lifescience_agent/deploy/hub
   ```
2. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   * Fill in your database and Redis passwords.
   * **CRITICAL:** Paste your Mac Mini's Tailscale IP into the `SPOKE_TAILSCALE_IP` variable.
   * Ensure `USE_S3=True` and `MINIO_PUBLIC_URL=https://storage.lifescienceaiagents.com`.
3. **Start the Compute Engine:**
   ```bash
   docker compose up -d --build
   ```
   *(The `--build` flag is required so Contabo builds the Frontend code locally).*

---

## ✅ Step 5: Verification

1. **Test the Website:** Go to `https://ai.lifescienceaiagents.com`. The site should load instantly.
2. **Test the Backend:** Go to `https://backend.lifescienceaiagents.com/api/v1/health/` to ensure the API is running.
3. **Test the Admin Dashboards:** Access `https://ai.lifescienceaiagents.com/admin` and `https://ai.lifescienceaiagents.com/superadmin`.
4. **Test the AI:** Log into n8n at `https://n8n.lifescienceaiagents.com`.
5. **Test the Edge Storage:** Upload a file through your Django application. It will be seamlessly transmitted across the ocean and securely saved onto your Mac Mini's physical hard drive!
