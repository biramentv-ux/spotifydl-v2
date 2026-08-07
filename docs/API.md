# API Documentation

## GraphQL Endpoint

`POST /graphql`

### Queries

#### Health Check
```graphql
query {
  health {
    status
    uptime
    timestamp
  }
}
```

#### Get Track
```graphql
query {
  track(id: "TRACK_ID") {
    id
    name
    artists {
      name
    }
    album {
      name
      releaseDate
    }
    durationMs
    explicit
    popularity
  }
}
```

#### Search
```graphql
query {
  search(query: "Never Gonna Give You Up", type: "track", limit: 5) {
    tracks {
      id
      name
      artists {
        name
      }
    }
  }
}
```

#### Download Queue
```graphql
query {
  downloadQueue {
    id
    track {
      name
      artists {
        name
      }
    }
    status
    progress
    speed
  }
}
```

#### Download Stats
```graphql
query {
  downloadStats {
    queued
    active
    completed
    failed
  }
}
```

#### User Profile
```graphql
query {
  me {
    id
    displayName
    email
    level
    xp
  }
}
```

#### Leaderboard
```graphql
query {
  leaderboard(limit: 10) {
    userId
    currentXP
    level
    title
  }
}
```

### Mutations

#### Queue Download
```graphql
mutation {
  queueDownload(trackId: "TRACK_ID") {
    id
    status
    track {
      name
    }
  }
}
```

#### Queue Playlist
```graphql
mutation {
  queuePlaylist(playlistId: "PLAYLIST_ID") {
    id
    track {
      name
    }
  }
}
```

#### Cancel Download
```graphql
mutation {
  cancelDownload(taskId: "TASK_ID")
}
```

#### Clear History
```graphql
mutation {
  clearHistory
}
```

#### Logout
```graphql
mutation {
  logout
}
```

### Subscriptions

#### Download Progress (WebSocket)
```graphql
subscription {
  downloadProgress {
    taskId
    trackId
    progress
    speed
    status
  }
}
```

## REST API

### Authentication

All endpoints require Bearer token except `/health` and `/auth/*`.

```
Authorization: Bearer <jwt-token>
```

### Endpoints

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

#### GET /api/v1/config
Get safe configuration (sensitive data removed).

#### GET /api/v1/tracks/:id
Get track details.

#### POST /api/v1/download
Queue a download.

**Body:**
```json
{
  "trackId": "spotify-track-id"
}
```

#### GET /api/v1/queue
Get download queue.

#### DELETE /api/v1/queue/:taskId
Cancel a download.

#### GET /api/v1/stats
Get download statistics.

#### GET /api/v1/leaderboard
Get XP leaderboard.

## WebSocket

Connect to `ws://localhost:3000/ws`

### Message Format

```json
{
  "type": "subscribe",
  "channel": "downloads"
}
```

### Channels

- `downloads` - Download progress updates
- `xp` - XP gain events
- `badges` - Badge award events
- `all` - All events

### Events

#### download:progress
```json
{
  "type": "download",
  "data": {
    "taskId": "...",
    "trackId": "...",
    "progress": 45.5,
    "speed": 1024000,
    "status": "downloading"
  }
}
```

#### xp:gain
```json
{
  "type": "xp",
  "data": {
    "userId": "...",
    "points": 50,
    "level": 5,
    "leveledUp": false
  }
}
```

## Webhooks

### Register Webhook

```bash
POST /webhooks/register
{
  "url": "https://your-app.com/webhook",
  "events": ["download:complete", "download:error"],
  "secret": "optional-secret"
}
```

### Events

#### download:complete
```json
{
  "event": "download:complete",
  "payload": {
    "trackId": "...",
    "filePath": "/downloads/..."
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### download:error
```json
{
  "event": "download:error",
  "payload": {
    "trackId": "...",
    "error": "..."
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Error Codes

- `AUTH_REQUIRED` - Authentication required
- `INVALID_TRACK_ID` - Invalid Spotify track ID
- `DOWNLOAD_FAILED` - Download engine failure
- `RATE_LIMITED` - Too many requests
- `NOT_FOUND` - Resource not found
