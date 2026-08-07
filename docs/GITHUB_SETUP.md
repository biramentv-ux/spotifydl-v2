# 🚀 GitHub Setup & CI/CD Guide — SpotifyDL v2

Complete step-by-step guide to push this project to GitHub and configure auto-deployment.

---

## Quick Start (2 Scripts)

We prepared 2 scripts that do everything automatically:

### Script 1: Setup GitHub Repo (One-Time)

```bash
cd spotify_hybrid_downloader_v2
./scripts/setup-github.sh
```

This script will:
- Ask for your GitHub username
- Ask for GitHub Personal Access Token (PAT)
- Create the GitHub repository via API
- Push all code to GitHub
- Save config for future use

**Before running:** Create a GitHub PAT at https://github.com/settings/tokens with `repo` scope.

### Script 2: Full Deploy (Run Anytime)

```bash
./scripts/full-deploy.sh
```

This script will:
- Commit any local changes
- Push to GitHub
- Deploy to Fly.io (primary)
- Trigger Render deploy (mirror)
- Show DNS instructions for your domains

---

## Manual Setup (If Scripts Don't Work)

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `spotifydl-v2`
3. **Description**: `Advanced Spotify downloader with hybrid engines`
4. **Visibility**: Public or Private
5. **DO NOT** initialize with README, .gitignore, or license
6. Click **Create repository**

### Step 2: Push Local Code to GitHub

```bash
cd /path/to/spotify_hybrid_downloader_v2
git remote add origin https://github.com/YOUR_USERNAME/spotifydl-v2.git
git branch -M main
git push -u origin main
```

### Step 3: Configure GitHub Secrets

Go to: Repo → Settings → Secrets and variables → Actions → New repository secret

| Secret | How to Get |
|--------|-----------|
| `FLY_API_TOKEN` | Run `flyctl auth token` in terminal |
| `RENDER_API_KEY` | Render Dashboard → Account → API Keys |
| `RENDER_SERVICE_ID` | Render Dashboard → Service → URL has `srv-xxx` |

### Step 4: Verify CI/CD Pipeline

1. Edit any file (e.g., README.md)
2. Commit and push:
```bash
git add . && git commit -m "Test CI/CD" && git push origin main
```
3. Go to GitHub → Actions tab
4. Watch workflow run:
   - Test & Type Check
   - Deploy to Fly.io
   - Deploy to Render

---

## Step 5: Set Fly.io Secrets

```bash
flyctl secrets set SPOTIFY_CLIENT_ID="xxx" --app spotifydl-v2
flyctl secrets set SPOTIFY_CLIENT_SECRET="xxx" --app spotifydl-v2
flyctl secrets set NEO4J_URI="neo4j+s://xxx.databases.neo4j.io" --app spotifydl-v2
flyctl secrets set NEO4J_PASSWORD="xxx" --app spotifydl-v2
flyctl secrets set TELEGRAM_BOT_TOKEN="xxx" --app spotifydl-v2
flyctl secrets set JWT_SECRET="$(openssl rand -base64 32)" --app spotifydl-v2
```

---

## Step 6: Add Custom Domains

### Fly.io (dyrakarmy.eu)
```bash
flyctl certs add dyrakarmy.eu --app spotifydl-v2
flyctl certs add www.dyrakarmy.eu --app spotifydl-v2
flyctl ips list --app spotifydl-v2
```

### DNS Records
| Type | Name | Value |
|------|------|-------|
| A | @ | (IPv4 from flyctl ips list) |
| AAAA | @ | (IPv6 from flyctl ips list) |
| CNAME | www | spotifydl-v2.fly.dev |

### Render (dyrakarmy.online)
1. Render Dashboard → Settings → Custom Domains
2. Add `mirror.dyrakarmy.online`
3. Follow DNS instructions

---

## Quick Commands

```bash
# Push and deploy everything
./scripts/full-deploy.sh

# View logs
flyctl logs --app spotifydl-v2

# Restart
flyctl apps restart spotifydl-v2

# Scale
flyctl scale count 2 --app spotifydl-v2
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| FLY_API_TOKEN invalid | `flyctl auth token` → update in GitHub Secrets |
| Render deploy failed | Check Dashboard Logs, verify API key |
| Tests fail locally | Run `npm test` first, check tsconfig |
| Domain not working | Wait 5-60 min for DNS, check `dig dyrakarmy.eu` |
