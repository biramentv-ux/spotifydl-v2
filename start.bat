@echo off
chcp 65001 >nul
title SpotifyDL v2 Launcher
echo 🎵 SpotifyDL v2 — One-Click Launcher
echo ========================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install from https://nodejs.org
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm not found. Please reinstall Node.js from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo 📦 Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ npm install failed!
        pause
        exit /b 1
    )
) else (
    echo ✅ Dependencies already installed
)

if not exist ".env" (
    echo 📝 Creating .env file...
    (
        echo # Spotify API Credentials
        echo # Get from: https://developer.spotify.com/dashboard
        echo SPOTIFY_CLIENT_ID=your_client_id_here
        echo SPOTIFY_CLIENT_SECRET=your_client_secret_here
        echo.
        echo # Server Configuration
        echo SERVER_PORT=3000
        echo SERVER_HOST=0.0.0.0
        echo NODE_ENV=development
        echo.
        echo # Neo4j Database
        echo NEO4J_URI=bolt://localhost:7687
        echo NEO4J_PASSWORD=
        echo.
        echo # Telegram Bot ^(optional^)
        echo TELEGRAM_BOT_TOKEN=
        echo.
        echo # JWT Secret
        echo JWT_SECRET=your-jwt-secret-change-this
        echo.
        echo # Log Level
        echo LOG_LEVEL=info
    ) > .env
    echo ⚠️  Please edit .env with your credentials before continuing!
    pause
)

if exist "binding.gyp" (
    echo 🔧 Building native PlayPlay module...
    call npm run build:native
    if %errorlevel% neq 0 (
        echo ⚠️  Native build failed, continuing with fallback...
    )
)

echo 🏗️  Building TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ TypeScript build failed!
    pause
    exit /b 1
)

if not exist "dist\index.js" (
    echo ❌ dist/index.js not found after build!
    pause
    exit /b 1
)

echo.
echo 🚀 Starting SpotifyDL v2...
echo    → Web UI: http://localhost:3000
echo    → GraphQL: http://localhost:3000/graphql
echo.
call npm start
pause
