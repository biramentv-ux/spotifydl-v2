#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🎵 SpotifyDL v2 — One-Click Launcher${NC}"
echo "========================================"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install from https://nodejs.org${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please reinstall Node.js${NC}"
    exit 1
fi

if ! command -v ffmpeg &> /dev/null; then
    echo -e "${YELLOW}⚠️  ffmpeg not found. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y ffmpeg || echo -e "${YELLOW}⚠️  ffmpeg install failed, continuing...${NC}"
fi

if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cat > .env << 'EOF'
# Spotify API Credentials
# Get from: https://developer.spotify.com/dashboard
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here

# Server Configuration
SERVER_PORT=3000
SERVER_HOST=0.0.0.0
NODE_ENV=development

# Neo4j Database
NEO4J_URI=bolt://localhost:7687
NEO4J_PASSWORD=

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=

# JWT Secret
JWT_SECRET=your-jwt-secret-change-this

# Log Level
LOG_LEVEL=info
EOF
    echo -e "${YELLOW}⚠️  Please edit .env with your credentials before continuing!${NC}"
    read -p "Press Enter to continue..."
fi

if [ -f "binding.gyp" ]; then
    echo -e "${BLUE}🔧 Building native PlayPlay module...${NC}"
    npm run build:native || echo -e "${YELLOW}⚠️  Native build failed, continuing with fallback...${NC}"
fi

echo -e "${BLUE}🏗️  Building TypeScript...${NC}"
npm run build

if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ dist/index.js not found after build!${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Starting SpotifyDL v2...${NC}"
echo -e "${GREEN}   → Web UI: http://localhost:3000${NC}"
echo -e "${GREEN}   → GraphQL: http://localhost:3000/graphql${NC}"
echo ""

npm start
