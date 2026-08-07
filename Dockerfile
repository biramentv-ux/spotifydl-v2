# =============================================================================
# SpotifyDL v2 — Production Dockerfile
# Optimized for Fly.io, Render, and any Docker-compatible cloud platform
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: Builder — compiles TypeScript + native C++ module
# -----------------------------------------------------------------------------
FROM node:20-slim AS builder

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ cmake curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first (better Docker layer caching)
COPY package*.json ./
COPY binding.gyp ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build native C++ module (PlayPlay decryption)
RUN npm run build:native || echo "⚠️ Native build optional, continuing..."

# Compile TypeScript
RUN npm run build

# -----------------------------------------------------------------------------
# STAGE 2: Production — minimal runtime image
# -----------------------------------------------------------------------------
FROM node:20-slim AS production

# Install runtime dependencies: ffmpeg + curl (for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r spotifydl && useradd -r -g spotifydl -d /app spotifydl

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder --chown=spotifydl:spotifydl /app/dist ./dist
COPY --from=builder --chown=spotifydl:spotifydl /app/node_modules ./node_modules
COPY --from=builder --chown=spotifydl:spotifydl /app/package*.json ./
COPY --from=builder --chown=spotifydl:spotifydl /app/build ./build
COPY --from=builder --chown=spotifydl:spotifydl /app/config ./config
COPY --from=builder --chown=spotifydl:spotifydl /app/public ./public
COPY --from=builder --chown=spotifydl:spotifydl /app/plugins ./plugins

# Create persistent directories
RUN mkdir -p downloads logs data && chown -R spotifydl:spotifydl /app

# Switch to non-root user
USER spotifydl

# Runtime environment
ENV NODE_ENV=production
ENV SERVER_PORT=3000
ENV SERVER_HOST=0.0.0.0

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/index.js"]
