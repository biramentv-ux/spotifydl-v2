# 🚀 Deployment Guide — SpotifyDL v2

Complete guide for deploying SpotifyDL v2 to the cloud using **free tiers**.

---

## 📋 Table of Contents

1. [Recommended Platform](#recommended-platform)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Option A: Fly.io (Recommended)](#option-a-flyio-recommended)
5. [Option B: Render.com (Mirror)](#option-b-rendercom-mirror)
6. [Neo4j Database Setup](#neo4j-database-setup)
7. [Custom Domains](#custom-domains)
8. [Environment Variables](#environment-variables)
9. [Monitoring & Logs](#monitoring--logs)
10. [Troubleshooting](#troubleshooting)

---

## Recommended Platform

| Platform | Free Tier | Best For | Why |
|----------|-----------|----------|-----|
| **Fly.io** ⭐ | 3 VMs, 3GB volumes | Primary deployment | No sleep, Docker native, WebSocket, EU/US regions |
| **Render** | 1 web service | Mirror / backup | Easy GitHub integration, auto-deploy |
| **Neo4j Aura** | 1 instance, 200K queries/day | Database | Managed, zero maintenance |

**Recommended stack:** Fly.io (app) + Neo4j Aura (database) + Render (mirror)

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   dyrakarmy.eu  │     │ dyrakarmy.online│     │  Telegram Bot   │
│   (Main Domain) │     │  (Mirror Domain)│     │  (WebHook)      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────┬───────────┘                       │
                     ▼                                   ▼
         ┌─────────────────────┐              ┌─────────────────────┐
         │    Fly.io (Primary) │◄────────────►│   Neo4j Aura Free   │
         │   spotifydl-v2      │   Bolt/TLS   │   Managed Graph DB  │
         │   Frankfurt region  │              │                     │
         └─────────────────────┘              └─────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐
│   Render (Mirror)   │  │   GitHub Actions    │
│   spotifydl-v2      │  │   CI/CD Pipeline    │
│   Auto-deploy       │  │   Auto-deploy both  │
└─────────────────────┘  └─────────────────────┘
```

---

## Prerequisites

- [Git](https://git-scm.com/) installed
- [Docker](https://docker.com/) installed (for local testing)
- [Fly.io account](https://fly.io/app/signup) (free, no credit card)
- [Render account](https://render.com/) (free)
- [Neo4j Aura account](https://neo4j.com/cloud/aura/) (free)
- [GitHub repository](https://github.com/new) with your code pushed
- Your 2 domains registered and DNS access:
  - `dyrakarmy.eu` (main)
  - `dyrakarmy.online` (mirror)

---

## Option A: Fly.io (Recommended)

### Step 1: Install Flyctl

```bash
# macOS / Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Add to PATH (if not automatic)
export PATH="$HOME/.fly/bin:$PATH"
```

### Step 2: Login

```bash
flyctl auth login
```

### Step 3: Launch App

```bash
# From project root
cd spotify_hybrid_downloader_v2

# Launch (creates app if not exists)
flyctl launch --name spotifydl-v2 --region fra --dockerfile Dockerfile

# Or use our deploy script
chmod +x scripts/deploy-fly.sh
./scripts/deploy-fly.sh
```

### Step 4: Create Persistent Volume

```bash
# 3GB free volume for downloads, logs, config
flyctl volumes create spotifydl_data --size 3 --region fra --app spotifydl-v2
```

### Step 5: Set Secrets

```bash
# Spotify API credentials (get from https://developer.spotify.com/dashboard)
flyctl secrets set SPOTIFY_CLIENT_ID="your_id" --app spotifydl-v2
flyctl secrets set SPOTIFY_CLIENT_SECRET="your_secret" --app spotifydl-v2

# Neo4j Aura connection (see Neo4j setup below)
flyctl secrets set NEO4J_URI="neo4j+s://xxxxx.databases.neo4j.io" --app spotifydl-v2
flyctl secrets set NEO4J_PASSWORD="your_aura_password" --app spotifydl-v2

# Telegram bot (optional)
flyctl secrets set TELEGRAM_BOT_TOKEN="your_bot_token" --app spotifydl-v2

# JWT secret (generate a strong random string)
flyctl secrets set JWT_SECRET="$(openssl rand -base64 32)" --app spotifydl-v2
```

### Step 6: Deploy

```bash
flyctl deploy --app spotifydl-v2
```

### Step 7: Verify

```bash
# Check status
flyctl status --app spotifydl-v2

# View logs
flyctl logs --app spotifydl-v2

# Open in browser
flyctl open --app spotifydl-v2
```

---

## Option B: Render.com (Mirror)

### Method 1: Blueprint (Recommended)

1. Push code to GitHub
2. In Render Dashboard → **Blueprints** → **New Blueprint Instance**
3. Connect your GitHub repo
4. Render reads `render.yaml` automatically
5. Set environment variables in Dashboard → **Environment**
6. Deploy!

### Method 2: Manual

1. Dashboard → **New** → **Web Service**
2. Connect GitHub repo
3. Runtime: **Docker**
4. Root Directory: `./`
5. Docker Build Context: `./`
6. Set environment variables (same as Fly.io)
7. **Create Web Service**

---

## Neo4j Database Setup

### Neo4j Aura (Recommended — Free)

1. Go to [neo4j.com/cloud/aura](https://neo4j.com/cloud/aura/)
2. Sign up / Login
3. **New Instance** → **Free**
4. Choose region (match your app region: `Europe` for Fly.io `fra`)
5. Wait for provisioning (~2 minutes)
6. Copy:
   - **Connection URI** (e.g., `neo4j+s://xxxxx.databases.neo4j.io`)
   - **Password** (shown once, save it!)
7. Set these as `NEO4J_URI` and `NEO4J_PASSWORD` secrets

### Self-Hosted Neo4j (Advanced)

If you prefer self-hosted on Fly.io:

```bash
# Create Neo4j app
flyctl apps create spotifydl-neo4j

# Create volume for Neo4j data
flyctl volumes create neo4j_data --size 3 --region fra --app spotifydl-neo4j

# Deploy Neo4j (using official image)
flyctl deploy --image neo4j:5-community --app spotifydl-neo4j \
  --env NEO4J_AUTH=neo4j/your_password \
  --env NEO4J_PLUGINS='["apoc"]' \
  --mount source=neo4j_data,destination=/data

# Update app to use internal Neo4j
flyctl secrets set NEO4J_URI="bolt://spotifydl-neo4j.internal:7687" --app spotifydl-v2
flyctl secrets set NEO4J_PASSWORD="your_password" --app spotifydl-v2
```

---

## Custom Domains

### Fly.io Custom Domains

```bash
# Add main domain
flyctl certs add dyrakarmy.eu --app spotifydl-v2
flyctl certs add www.dyrakarmy.eu --app spotifydl-v2

# Add mirror domain
flyctl certs add dyrakarmy.online --app spotifydl-v2
flyctl certs add www.dyrakarmy.online --app spotifydl-v2
```

### DNS Configuration

Login to your domain registrar and add these DNS records:

**For `dyrakarmy.eu` (Main):**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `66.241.124.0` | 3600 |
| AAAA | @ | `2a09:8280:1::1:3c9a` | 3600 |
| CNAME | www | `spotifydl-v2.fly.dev` | 3600 |

**For `dyrakarmy.online` (Mirror):**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `66.241.124.0` | 3600 |
| AAAA | @ | `2a09:8280:1::1:3c9a` | 3600 |
| CNAME | www | `spotifydl-v2.fly.dev` | 3600 |

> ⚠️ **Get your actual Fly.io IPs** after deploy with: `flyctl ips list --app spotifydl-v2`

### Render Custom Domain (Mirror)

1. Render Dashboard → Your Service → **Settings** → **Custom Domains**
2. Add `mirror.dyrakarmy.online` (or any subdomain)
3. Follow Render's DNS instructions
4. Add CNAME record pointing to Render's URL

---

## Environment Variables

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `SPOTIFY_CLIENT_ID` | ✅ | Spotify API client ID | [Spotify Dashboard](https://developer.spotify.com/dashboard) |
| `SPOTIFY_CLIENT_SECRET` | ✅ | Spotify API secret | [Spotify Dashboard](https://developer.spotify.com/dashboard) |
| `NEO4J_URI` | ✅ | Neo4j connection URI | [Neo4j Aura](https://neo4j.com/cloud/aura/) |
| `NEO4J_PASSWORD` | ✅ | Neo4j password | [Neo4j Aura](https://neo4j.com/cloud/aura/) |
| `JWT_SECRET` | ✅ | Random string for JWT signing | Generate: `openssl rand -base64 32` |
| `TELEGRAM_BOT_TOKEN` | ❌ | Telegram Bot API token | [@BotFather](https://t.me/BotFather) |
| `SERVER_PORT` | ✅ | Server port | `3000` (default) |
| `SERVER_HOST` | ✅ | Server bind host | `0.0.0.0` |
| `NODE_ENV` | ✅ | Environment | `production` |
| `LOG_LEVEL` | ❌ | Logging level | `info` |

---

## Monitoring & Logs

### Fly.io

```bash
# Real-time logs
flyctl logs --app spotifydl-v2

# Metrics dashboard
open https://fly.io/apps/spotifydl-v2

# SSH into machine (debugging)
flyctl ssh console --app spotifydl-v2
```

### Render

```bash
# Logs via CLI
render logs --service spotifydl-v2

# Or visit: https://dashboard.render.com
```

---

## Troubleshooting

### "Native module not found"

The native C++ module is built during Docker build. If missing:

```bash
# Rebuild with verbose output
flyctl deploy --app spotifydl-v2 --build-arg NODE_ENV=production
```

### "Cannot connect to Neo4j"

1. Verify `NEO4J_URI` uses `neo4j+s://` (Aura) or `bolt://` (self-hosted)
2. Check Aura instance is active in [Neo4j Console](https://console.neo4j.io/)
3. Test connection locally: `cypher-shell -a <uri> -u neo4j -p <password>`

### "App sleeps / WebSocket disconnects"

- **Fly.io**: Free tier VMs don't sleep. Ensure `auto_stop_machines = false` in `fly.toml`
- **Render**: Free web services sleep after 15 min inactivity. Upgrade to paid plan or use a ping service

### "Out of memory"

```bash
# Scale up memory (paid tier required for >512MB)
flyctl scale memory 1024 --app spotifydl-v2
```

### "Volume full"

```bash
# Check disk usage
flyctl ssh console --app spotifydl-v2 -- df -h

# Clean old downloads
flyctl ssh console --app spotifydl-v2 -- rm -rf /app/data/downloads/*
```

---

## CI/CD (GitHub Actions)

The project includes `.github/workflows/deploy.yml` that:

1. Runs tests on every PR
2. Auto-deploys to Fly.io on push to `main`
3. Auto-deploys to Render as mirror

### Setup GitHub Secrets

Go to GitHub Repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|--------|-------|
| `FLY_API_TOKEN` | Get from: `flyctl auth token` |
| `RENDER_API_KEY` | Get from: [Render Dashboard](https://dashboard.render.com) → Account Settings |
| `RENDER_SERVICE_ID` | Your Render service ID |

---

## Cost Estimate

| Component | Platform | Free Tier | Paid (if needed) |
|-----------|----------|-----------|------------------|
| App | Fly.io | 3 VMs, 3GB volumes | ~$2-5/month |
| Mirror | Render | 1 web service | ~$7/month |
| Database | Neo4j Aura | 200K queries/day | ~$9/month |
| Domains | Registrar | ~$10-15/year each | — |

**Total free tier cost: $0/month** ✅

---

## Quick Reference

```bash
# Deploy to Fly.io
flyctl deploy --app spotifydl-v2

# View logs
flyctl logs --app spotifydl-v2

# Restart app
flyctl apps restart spotifydl-v2

# Scale machines
flyctl scale count 2 --app spotifydl-v2

# Destroy app (careful!)
flyctl apps destroy spotifydl-v2
```

---

## Support

- Fly.io Docs: [https://fly.io/docs/](https://fly.io/docs/)
- Render Docs: [https://render.com/docs](https://render.com/docs)
- Neo4j Aura Docs: [https://neo4j.com/docs/aura/](https://neo4j.com/docs/aura/)
