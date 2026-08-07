#!/bin/bash
# =============================================================================
# SpotifyDL v2 — GitHub Setup Script
# One-time setup: creates repo, pushes code, configures everything
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          🎵 SpotifyDL v2 — GitHub Setup Script               ║"
echo "║     One-time setup: creates repo & pushes code             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
command -v git >/dev/null 2>&1 || { echo -e "${RED}❌ git is required${NC}"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo -e "${RED}❌ curl is required${NC}"; exit 1; }

# Check if in git repo
if [ ! -d .git ]; then
    echo -e "${RED}❌ Not a git repository. Run from project root.${NC}"
    exit 1
fi

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USER
if [ -z "$GITHUB_USER" ]; then
    echo -e "${RED}❌ GitHub username is required${NC}"
    exit 1
fi

# Get repo name
read -p "Enter repository name [spotifydl-v2]: " REPO_NAME
REPO_NAME=${REPO_NAME:-spotifydl-v2}

# Get GitHub token (for API access)
echo ""
echo -e "${YELLOW}ℹ️  You need a GitHub Personal Access Token (PAT)${NC}"
echo -e "${YELLOW}   Create one at: https://github.com/settings/tokens${NC}"
echo -e "${YELLOW}   Required scopes: repo (full control)${NC}"
read -s -p "Enter GitHub PAT: " GITHUB_TOKEN
echo ""

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ GitHub token is required${NC}"
    exit 1
fi

# Verify token
echo -e "${BLUE}🔐 Verifying GitHub token...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user)
if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ Invalid GitHub token (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
USER_CHECK=$(curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user | grep -o '"login":"[^"]*"' | cut -d'"' -f4)
if [ "$USER_CHECK" != "$GITHUB_USER" ]; then
    echo -e "${YELLOW}⚠️  Token belongs to: $USER_CHECK (you entered: $GITHUB_USER)${NC}"
    read -p "Continue anyway? [y/N]: " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
fi
echo -e "${GREEN}✅ Token verified for $USER_CHECK${NC}"

# Create repository
echo -e "${BLUE}📦 Creating GitHub repository...${NC}"
REPO_RESPONSE=$(curl -s -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"$REPO_NAME\",\"description\":\"Advanced Spotify downloader with hybrid engines, GraphQL, WebSocket, Telegram bot, Neo4j, ML recommendations\",\"private\":false,\"auto_init\":false}")

if echo "$REPO_RESPONSE" | grep -q '"message":"Repository creation failed"'; then
    if echo "$REPO_RESPONSE" | grep -q 'already exists'; then
        echo -e "${YELLOW}⚠️  Repository already exists, continuing...${NC}"
    else
        echo -e "${RED}❌ Failed to create repository${NC}"
        echo "$REPO_RESPONSE" | grep -o '"message":"[^"]*"'
        exit 1
    fi
else
    echo -e "${GREEN}✅ Repository created: https://github.com/$GITHUB_USER/$REPO_NAME${NC}"
fi

# Add remote and push
echo -e "${BLUE}📤 Pushing code to GitHub...${NC}"
if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "https://$GITHUB_USER:$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO_NAME.git"
else
    git remote add origin "https://$GITHUB_USER:$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO_NAME.git"
fi

git branch -M main 2>/dev/null || true

# Commit any uncommitted changes
if ! git diff --cached --quiet 2>/dev/null; then
    git add -A
    git commit -m "Setup: prepare for GitHub push" || true
fi

git push -u origin main --force
echo -e "${GREEN}✅ Code pushed successfully!${NC}"

# Save config for future use
cat > .github-config <<EOF
GITHUB_USER=$GITHUB_USER
REPO_NAME=$REPO_NAME
EOF
echo -e "${GREEN}💾 Config saved to .github-config${NC}"

# Print next steps
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                  ✅ SETUP COMPLETE!                          ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📁 Repository: https://github.com/$GITHUB_USER/$REPO_NAME${NC}"
echo ""
echo -e "${YELLOW}📋 NEXT STEPS:${NC}"
echo -e "${YELLOW}   1. Go to: https://github.com/$GITHUB_USER/$REPO_NAME/settings/secrets/actions${NC}"
echo -e "${YELLOW}   2. Add these secrets:${NC}"
echo -e "${YELLOW}      • FLY_API_TOKEN      (run: flyctl auth token)${NC}"
echo -e "${YELLOW}      • RENDER_API_KEY     (from Render Dashboard)${NC}"
echo -e "${YELLOW}      • RENDER_SERVICE_ID  (from Render Dashboard)${NC}"
echo ""
echo -e "${YELLOW}   3. Run deploy: ./scripts/full-deploy.sh${NC}"
echo ""
echo -e "${CYAN}🎉 Your code is now on GitHub!${NC}"
