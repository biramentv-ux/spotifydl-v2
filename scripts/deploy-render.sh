#!/bin/bash
# =============================================================================
# SpotifyDL v2 — Render.com Deployment Script (Mirror)
# Usage: ./scripts/deploy-render.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 SpotifyDL v2 — Render.com Deploy (Mirror)${NC}"
echo "============================================="

# Check if logged in to Render
if ! command -v render &> /dev/null; then
    echo -e "${YELLOW}⚠️  Render CLI not found.${NC}"
    echo -e "${YELLOW}   Install from: https://render.com/docs/cli${NC}"
    echo -e "${YELLOW}   Or deploy manually via dashboard.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Deploying via Render Blueprint...${NC}"
echo -e "${YELLOW}   Make sure you have connected your GitHub repo to Render.${NC}"

# Blueprint deploy
render blueprint apply

echo ""
echo -e "${GREEN}✅ Render deployment initiated!${NC}"
echo -e "${GREEN}   → Check dashboard: https://dashboard.render.com${NC}"
