# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   CLI    │  │  Web UI  │  │ Telegram │  │  Mobile  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
                    ┌────────▼────────┐
                    │   Express App   │
                    │  (SpotifyDLApp) │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────┐  ┌─────────▼─────────┐  ┌───────▼──────┐
│  GraphQL     │  │    REST API       │  │  WebSocket   │
│  (Apollo)    │  │   (/api/v1/*)     │  │   (/ws)      │
└───────┬──────┘  └─────────┬─────────┘  └───────┬──────┘
        │                   │                    │
        └───────────────────┼────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │      Core Services          │
              │  ┌─────────────────────┐   │
              │  │   ConfigManager     │   │
              │  │   EventBus          │   │
              │  │   Logger (Winston)  │   │
              │  │   TokenExtractor    │   │
              │  └─────────────────────┘   │
              └─────────────┬───────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐  ┌────────▼────────┐  ┌──────▼──────┐
│   Download   │  │     Auth        │  │    ML/AI    │
│   Engine     │  │   (OAuth2/JWT)  │  │             │
│              │  │                 │  │  Feature    │
│  ┌────────┐  │  │  XPSystem       │  │  Extractor  │
│  │PlayPlay│  │  │  BadgeSystem    │  │  Collab     │
│  │Widevine│  │  │                 │  │  Filter     │
│  │Hybrid  │  │  └─────────────────┘  │  Recommend  │
│  └────────┘  │                         │  Engine     │
└──────────────┘                         └─────────────┘
        │                                           │
        │         ┌─────────────────────┐           │
        │         │   Metadata          │           │
        │         │   (ID3/LRCLIB)      │           │
        │         └─────────────────────┘           │
        │                                           │
        └───────────────────┬───────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐  ┌────────▼────────┐  ┌──────▼──────┐
│  External    │  │   Storage       │  │   Graph DB  │
│  Services    │  │                 │  │             │
│              │  │  Google Drive   │  │   Neo4j     │
│  Spotify API │  │  Dropbox        │  │             │
│  LRCLIB      │  │  Local FS       │  │  User       │
│  Telegram    │  │                 │  │  Track      │
│  FFmpeg      │  └─────────────────┘  │  Relations  │
└──────────────┘                         └─────────────┘
```

## Module Descriptions

### Core Layer
- **Logger**: Winston-based logging with emoji, file rotation, and structured output
- **EventBus**: Typed EventEmitter for decoupled communication between modules
- **ConfigManager**: JSON + environment variable configuration with deep merge
- **TokenExtractor**: Anonymous Spotify token extraction with caching
- **SpotifyAPI**: Full wrapper around Spotify Web API with chunking support

### Download Layer
- **HybridEngine**: Auto-selects best decryption method with fallback strategy
- **PlayPlayEngine**: Primary download engine using PlayPlay CDN
- **WidevineEngine**: Fallback using Widevine CDM decryption

### Auth Layer
- **AuthManager**: OAuth2 flow with JWT sessions and refresh tokens
- **XPSystem**: 20-level progression system with streak bonuses
- **BadgeSystem**: 15+ achievements with rarity tiers

### Data Layer
- **Neo4jClient**: Graph database for user-track relationships and recommendations
- **MetadataEmbedder**: ID3v2.4 tags, cover art, synced lyrics
- **LRCLIBClient**: Lyrics API client with caching

### API Layer
- **GraphQLServer**: Apollo Server with subscriptions
- **WebSocketServer**: Real-time progress updates
- **WebhookManager**: Outgoing webhook delivery

### Integration Layer
- **TelegramBot**: Remote control and notifications
- **CloudUploader**: Google Drive and Dropbox upload
- **AutoUpdater**: Semver-based update checking

## Data Flow

### Download Flow
```
User Request → SpotifyAPI (track info) → HybridEngine (download)
    → MetadataEmbedder (tags + lyrics) → CloudUploader (optional)
    → EventBus (notifications) → WebSocket (progress)
```

### Recommendation Flow
```
User History → Neo4j (collaborative) + SpotifyAPI (audio features)
    → FeatureExtractor (normalize) → RecommendationEngine (score)
    → GraphQL (response)
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Language | TypeScript 5.0 |
| Framework | Express.js |
| GraphQL | Apollo Server |
| WebSocket | ws |
| Database | Neo4j |
| Auth | JWT + OAuth2 |
| ML | Custom collaborative filtering |
| Plugins | vm2 sandbox |
| Testing | Jest |
| Logging | Winston |
