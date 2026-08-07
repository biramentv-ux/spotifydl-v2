# =============================================================================
# SpotifyDL v2 — Fly.io Deploy Script (Windows PowerShell)
# =============================================================================
# Usage:
#   .\scripts\deploy-fly.ps1
# Or with custom app name:
#   .\scripts\deploy-fly.ps1 -AppName "my-spotifydl"
# =============================================================================

param(
    [string]$AppName = "spotifydl-v2",
    [string]$Region = "fra",
    [string]$VolumeName = "spotifydl_data",
    [int]$VolumeSize = 3
)

# Colors
$Red = "Red"
$Green = "Green"
$Blue = "Cyan"
$Yellow = "Yellow"

function Info($msg)  { Write-Host "  INFO  $msg" -ForegroundColor $Blue }
function Ok($msg)    { Write-Host "   OK   $msg" -ForegroundColor $Green }
function Warn($msg)  { Write-Host "  WARN  $msg" -ForegroundColor $Yellow }
function Err($msg)   { Write-Host "  ERR   $msg" -ForegroundColor $Red }
function Step($msg)  { Write-Host ""; Write-Host "==> $msg" -ForegroundColor $Blue -BackgroundColor Black; Write-Host "" }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
Step "Pre-flight checks"

# Check flyctl
if (-not (Get-Command flyctl -ErrorAction SilentlyContinue)) {
    Err "flyctl not found. Install it first:"
    Write-Host ""
    Write-Host "  Windows:  iwr https://fly.io/install.ps1 -useb | iex"
    Write-Host "  Or:       winget install FlyIo.flyctl"
    Write-Host ""
    Write-Host "  Then restart PowerShell and try again."
    exit 1
}
Ok "flyctl found"

# Check auth
$authCheck = flyctl auth whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Warn "Not logged in to Fly.io"
    Info "Running: flyctl auth login"
    flyctl auth login
    $authCheck = flyctl auth whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        Err "Login failed. Try manually: flyctl auth login"
        exit 1
    }
}
Ok "Authenticated as: $authCheck"

# Check project directory
if (-not (Test-Path "fly.toml")) {
    Err "fly.toml not found. Are you in the project root?"
    exit 1
}
Ok "fly.toml found"

if (-not (Test-Path "Dockerfile")) {
    Err "Dockerfile not found. Are you in the project root?"
    exit 1
}
Ok "Dockerfile found"

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
Step "App setup"

$appStatus = flyctl status --app $AppName 2>&1
if ($LASTEXITCODE -eq 0) {
    Ok "App $AppName already exists"
} else {
    Info "Creating app: $AppName in region: $Region"
    flyctl apps create $AppName --org personal
    Ok "App created"
}

# ---------------------------------------------------------------------------
# Volume setup
# ---------------------------------------------------------------------------
Step "Volume setup"

$volList = flyctl volumes list --app $AppName 2>&1
if ($volList -match $VolumeName) {
    Ok "Volume $VolumeName already exists"
} else {
    Info "Creating volume: $VolumeName (${VolumeSize}GB) in $Region"
    flyctl volumes create $VolumeName --size $VolumeSize --region $Region --app $AppName
    Ok "Volume created"
}

# ---------------------------------------------------------------------------
# Secrets
# ---------------------------------------------------------------------------
Step "Environment secrets"

Info "Checking required secrets..."

$secretList = flyctl secrets list --app $AppName 2>&1

$missingSecrets = @()

if (-not ($secretList -match "^SPOTIFY_CLIENT_ID")) {
    Warn "Secret SPOTIFY_CLIENT_ID is NOT set"
    $missingSecrets += "SPOTIFY_CLIENT_ID"
} else {
    Ok "Secret SPOTIFY_CLIENT_ID is set"
}

if (-not ($secretList -match "^SPOTIFY_CLIENT_SECRET")) {
    Warn "Secret SPOTIFY_CLIENT_SECRET is NOT set"
    $missingSecrets += "SPOTIFY_CLIENT_SECRET"
} else {
    Ok "Secret SPOTIFY_CLIENT_SECRET is set"
}

if (-not ($secretList -match "^JWT_SECRET")) {
    Warn "Secret JWT_SECRET is NOT set"
    $missingSecrets += "JWT_SECRET"
} else {
    Ok "Secret JWT_SECRET is set"
}

if ($missingSecrets.Count -gt 0) {
    Warn "Some secrets are missing:"
    Write-Host ""
    foreach ($secret in $missingSecrets) {
        switch ($secret) {
            "SPOTIFY_CLIENT_ID"     { Write-Host "  SPOTIFY_CLIENT_ID     — https://developer.spotify.com/dashboard" }
            "SPOTIFY_CLIENT_SECRET" { Write-Host "  SPOTIFY_CLIENT_SECRET — https://developer.spotify.com/dashboard" }
            "JWT_SECRET"            { Write-Host "  JWT_SECRET            — Will be auto-generated" }
        }
    }
    Write-Host ""
    $setNow = Read-Host "Set them now? [Y/n]"
    $setNow = if ($setNow) { $setNow } else { "Y" }

    if ($setNow -match "^[Yy]$") {
        foreach ($secret in $missingSecrets) {
            switch ($secret) {
                "SPOTIFY_CLIENT_ID" {
                    $value = Read-Host "  SPOTIFY_CLIENT_ID"
                    flyctl secrets set "SPOTIFY_CLIENT_ID=$value" --app $AppName
                }
                "SPOTIFY_CLIENT_SECRET" {
                    $value = Read-Host "  SPOTIFY_CLIENT_SECRET"
                    flyctl secrets set "SPOTIFY_CLIENT_SECRET=$value" --app $AppName
                }
                "JWT_SECRET" {
                    $bytes = New-Object byte[] 32
                    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
                    $value = [Convert]::ToBase64String($bytes)
                    flyctl secrets set "JWT_SECRET=$value" --app $AppName
                    Ok "JWT_SECRET auto-generated"
                }
            }
        }
    } else {
        Warn "Secrets not set. Deployment may fail."
    }
} else {
    Ok "All required secrets are set"
}

# Optional secrets
Info "Optional secrets (press Enter to skip):"
$tgToken = Read-Host "  TELEGRAM_BOT_TOKEN"
if ($tgToken) {
    flyctl secrets set "TELEGRAM_BOT_TOKEN=$tgToken" --app $AppName
    Ok "TELEGRAM_BOT_TOKEN set"
}

$neo4jUri = Read-Host "  NEO4J_URI"
if ($neo4jUri) {
    flyctl secrets set "NEO4J_URI=$neo4jUri" --app $AppName
    $neo4jPass = Read-Host "  NEO4J_PASSWORD"
    flyctl secrets set "NEO4J_PASSWORD=$neo4jPass" --app $AppName
    Ok "Neo4j credentials set"
}

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------
Step "Deploying to Fly.io"

Info "Building and deploying $AppName..."
flyctl deploy --app $AppName --dockerfile Dockerfile

if ($LASTEXITCODE -ne 0) {
    Err "Deployment failed!"
    exit 1
}

Ok "Deployment complete!"

# ---------------------------------------------------------------------------
# Post-deploy verification
# ---------------------------------------------------------------------------
Step "Post-deploy verification"

Info "Checking app status..."
flyctl status --app $AppName

Info "Recent logs..."
flyctl logs --app $AppName --tail 20

$appUrl = "https://$AppName.fly.dev"

Write-Host ""
Write-Host "  DEPLOYMENT SUCCESSFUL!" -ForegroundColor $Green -BackgroundColor Black
Write-Host ""
Write-Host "  App URL:     $appUrl"
Write-Host "  Health:      $appUrl/health"
Write-Host "  Dashboard:   $appUrl"
Write-Host "  GraphQL:     $appUrl/graphql"
Write-Host "  WebSocket:   wss://$AppName.fly.dev/ws"
Write-Host ""
Write-Host "  Fly Dashboard: https://fly.io/apps/$AppName"
Write-Host ""
Write-Host "  Useful commands:"
Write-Host "    flyctl logs --app $AppName"
Write-Host "    flyctl ssh console --app $AppName"
Write-Host "    flyctl apps restart $AppName"
Write-Host ""

# Custom domain
$setupDomain = Read-Host "Configure custom domain? [y/N]"
$setupDomain = if ($setupDomain) { $setupDomain } else { "N" }

if ($setupDomain -match "^[Yy]$") {
    $domain = Read-Host "  Domain (e.g., dyrakarmy.eu)"
    if ($domain) {
        Info "Adding certificate for $domain..."
        flyctl certs add $domain --app $AppName
        Ok "Certificate added. Update your DNS:"
        Write-Host ""
        $ips = flyctl ips list --app $AppName
        $v4 = ($ips | Select-String "v4" | ForEach-Object { ($_ -split "\s+")[0] })
        $v6 = ($ips | Select-String "v6" | ForEach-Object { ($_ -split "\s+")[0] })
        Write-Host "  A     @   →  $v4"
        Write-Host "  AAAA  @   →  $v6"
        Write-Host "  CNAME www →  $AppName.fly.dev"
    }
}

Write-Host ""
Write-Host "Happy downloading!" -ForegroundColor $Green
Write-Host ""
