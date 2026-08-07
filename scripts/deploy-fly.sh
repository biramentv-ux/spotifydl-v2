#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# SpotifyDL v2 — Fly.io Deploy Script
# =============================================================================

# Colors
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
CYAN='\033[36m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { echo -e "${CYAN}${BOLD}  INFO${RESET} $1"; }
ok()    { echo -e "${GREEN}${BOLD}   OK${RESET} $1"; }
warn()  { echo -e "${YELLOW}${BOLD} WARN${RESET} $1"; }
err()   { echo -e "${RED}${BOLD}  ERR${RESET} $1"; }
step()  { echo; echo -e "${BLUE}${BOLD}==>${RESET} ${BOLD}$1${RESET}"; echo; }

APP_NAME=${FLY_APP_NAME:-spotifydl-v2}
REGION=${FLY_REGION:-fra}
VOLUME_NAME=${FLY_VOLUME_NAME:-spotifydl_data}
VOLUME_SIZE=${FLY_VOLUME_SIZE:-3}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
step 'Pre-flight checks'

if ! command -v flyctl &>/dev/null; then
  err 'flyctl not found. Install it first:'
  echo ''
  echo '  macOS/Linux:  curl -L https://fly.io/install.sh | sh'
  echo '  Windows:      iwr https://fly.io/install.ps1 -useb | iex'
  echo ''
  echo '  Then: export PATH="$HOME/.fly/bin:$PATH"'
  exit 1
fi
ok 'flyctl found'

if ! flyctl auth whoami &>/dev/null; then
  warn 'Not logged in to Fly.io'
  info 'Running: flyctl auth login'
  flyctl auth login
  if ! flyctl auth whoami &>/dev/null; then
    err 'Login failed. Try manually: flyctl auth login'
    exit 1
  fi
fi
ok "Authenticated as: $(flyctl auth whoami)"

if [ ! -f 'fly.toml' ]; then
  err 'fly.toml not found. Are you in the project root?'
  exit 1
fi
ok 'fly.toml found'

if [ ! -f 'Dockerfile' ]; then
  err 'Dockerfile not found. Are you in the project root?'
  exit 1
fi
ok 'Dockerfile found'

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
step 'App setup'

if flyctl status --app "$APP_NAME" &>/dev/null; then
  ok "App $APP_NAME already exists"
else
  info "Creating app: $APP_NAME in region: $REGION"
  flyctl apps create "$APP_NAME" --org personal
  ok 'App created'
fi

# ---------------------------------------------------------------------------
# Volume setup
# ---------------------------------------------------------------------------
step 'Volume setup'

if flyctl volumes list --app "$APP_NAME" 2>/dev/null | grep -q "$VOLUME_NAME"; then
  ok "Volume $VOLUME_NAME already exists"
else
  info "Creating volume: $VOLUME_NAME (${VOLUME_SIZE}GB) in $REGION"
  flyctl volumes create "$VOLUME_NAME" --size "$VOLUME_SIZE" --region "$REGION" --app "$APP_NAME"
  ok 'Volume created'
fi

# ---------------------------------------------------------------------------
# Secrets
# ---------------------------------------------------------------------------
step 'Environment secrets'

info 'Checking required secrets...'

MISSING_SECRETS=()

check_secret() {
  local name=$1
  if flyctl secrets list --app "$APP_NAME" 2>/dev/null | grep -q "^$name"; then
    ok "Secret $name is set"
    return 0
  else
    warn "Secret $name is NOT set"
    return 1
  fi
}

check_secret 'SPOTIFY_CLIENT_ID'  || MISSING_SECRETS+=('SPOTIFY_CLIENT_ID')
check_secret 'SPOTIFY_CLIENT_SECRET' || MISSING_SECRETS+=('SPOTIFY_CLIENT_SECRET')
check_secret 'JWT_SECRET' || MISSING_SECRETS+=('JWT_SECRET')

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
  warn 'Some secrets are missing:'
  echo ''
  for secret in "${MISSING_SECRETS[@]}"; do
    case $secret in
      SPOTIFY_CLIENT_ID)
        echo '  SPOTIFY_CLIENT_ID     — https://developer.spotify.com/dashboard'
        ;;
      SPOTIFY_CLIENT_SECRET)
        echo '  SPOTIFY_CLIENT_SECRET — https://developer.spotify.com/dashboard'
        ;;
      JWT_SECRET)
        echo '  JWT_SECRET            — Will be auto-generated'
        ;;
    esac
  done
  echo ''
  read -rp 'Set them now? [Y/n]: ' SET_NOW
  SET_NOW=${SET_NOW:-Y}

  if [[ $SET_NOW =~ ^[Yy]$ ]]; then
    for secret in "${MISSING_SECRETS[@]}"; do
      case $secret in
        SPOTIFY_CLIENT_ID)
          read -rp '  SPOTIFY_CLIENT_ID: ' VALUE
          flyctl secrets set "SPOTIFY_CLIENT_ID=$VALUE" --app "$APP_NAME"
          ;;
        SPOTIFY_CLIENT_SECRET)
          read -rp '  SPOTIFY_CLIENT_SECRET: ' VALUE
          flyctl secrets set "SPOTIFY_CLIENT_SECRET=$VALUE" --app "$APP_NAME"
          ;;
        JWT_SECRET)
          VALUE=$(openssl rand -base64 32)
          flyctl secrets set "JWT_SECRET=$VALUE" --app "$APP_NAME"
          ok 'JWT_SECRET auto-generated'
          ;;
      esac
    done
  else
    warn 'Secrets not set. Deployment may fail.'
  fi
else
  ok 'All required secrets are set'
fi

# Optional secrets
info 'Optional secrets (press Enter to skip):'
read -rp '  TELEGRAM_BOT_TOKEN: ' TG_TOKEN
if [ -n "$TG_TOKEN" ]; then
  flyctl secrets set "TELEGRAM_BOT_TOKEN=$TG_TOKEN" --app "$APP_NAME"
  ok 'TELEGRAM_BOT_TOKEN set'
fi

read -rp '  NEO4J_URI: ' NEO4J_URI
if [ -n "$NEO4J_URI" ]; then
  flyctl secrets set "NEO4J_URI=$NEO4J_URI" --app "$APP_NAME"
  read -rp '  NEO4J_PASSWORD: ' NEO4J_PASS
  flyctl secrets set "NEO4J_PASSWORD=$NEO4J_PASS" --app "$APP_NAME"
  ok 'Neo4j credentials set'
fi

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------
step 'Deploying to Fly.io'

info "Building and deploying $APP_NAME..."
flyctl deploy --app "$APP_NAME" --dockerfile Dockerfile

ok 'Deployment complete!'

# ---------------------------------------------------------------------------
# Post-deploy verification
# ---------------------------------------------------------------------------
step 'Post-deploy verification'

info 'Checking app status...'
flyctl status --app "$APP_NAME"

info 'Recent logs...'
flyctl logs --app "$APP_NAME" --tail 20

APP_URL="https://$APP_NAME.fly.dev"

echo ''
echo -e "${GREEN}${BOLD}  DEPLOYMENT SUCCESSFUL!${RESET}"
echo ''
echo "  App URL:     ${CYAN}$APP_URL${RESET}"
echo "  Health:      $APP_URL/health"
echo "  Dashboard:   $APP_URL"
echo "  GraphQL:     $APP_URL/graphql"
echo "  WebSocket:   wss://$APP_NAME.fly.dev/ws"
echo ''
echo "  Fly Dashboard: https://fly.io/apps/$APP_NAME"
echo ''
echo '  Useful commands:'
echo "    flyctl logs --app $APP_NAME"
echo "    flyctl ssh console --app $APP_NAME"
echo "    flyctl apps restart $APP_NAME"
echo ''

# Custom domain
read -rp 'Configure custom domain? [y/N]: ' SETUP_DOMAIN
SETUP_DOMAIN=${SETUP_DOMAIN:-N}

if [[ $SETUP_DOMAIN =~ ^[Yy]$ ]]; then
  read -rp '  Domain (e.g., dyrakarmy.eu): ' DOMAIN
  if [ -n "$DOMAIN" ]; then
    info "Adding certificate for $DOMAIN..."
    flyctl certs add "$DOMAIN" --app "$APP_NAME"
    ok 'Certificate added. Update your DNS:'
    echo ''
    V4_IP=$(flyctl ips list --app "$APP_NAME" | grep 'v4' | awk '{print $3}' || echo 'See flyctl ips list')
    V6_IP=$(flyctl ips list --app "$APP_NAME" | grep 'v6' | awk '{print $3}' || echo 'See flyctl ips list')
    echo "  A     @   →  $V4_IP"
    echo "  AAAA  @   →  $V6_IP"
    echo "  CNAME www →  $APP_NAME.fly.dev"
  fi
fi

echo ''
echo -e "${GREEN}Happy downloading!${RESET}"
echo ''
