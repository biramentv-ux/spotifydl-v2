import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type Query {
    health: HealthStatus!
    track(id: ID!): Track
    search(query: String!, type: String, limit: Int): SearchResult
    downloadQueue: [DownloadTask!]!
    downloadHistory: [DownloadTask!]!
    downloadStats: DownloadStats!
    me: User
    sessions: [UserSession!]!
    leaderboard(limit: Int): [UserXP!]!
    userBadges(userId: ID!): [Badge!]!
  }

  type Mutation {
    queueDownload(trackId: ID!): DownloadTask!
    queuePlaylist(playlistId: ID!): [DownloadTask!]!
    cancelDownload(taskId: ID!): Boolean!
    clearHistory: Boolean!
    logout: Boolean!
    renderVisualization(audioPath: String!, mode: String!): VisualizationResult!
  }

  type Subscription {
    downloadProgress: DownloadProgress!
    xpUpdate: XPEvent!
    badgeAwarded: BadgeEvent!
  }

  type HealthStatus {
    status: String!
    uptime: Float!
    timestamp: String!
  }

  type Track {
    id: ID!
    name: String!
    artists: [Artist!]!
    album: Album!
    durationMs: Int!
    explicit: Boolean!
    popularity: Int!
    previewUrl: String
    trackNumber: Int!
  }

  type Artist {
    id: ID!
    name: String!
  }

  type Album {
    id: ID!
    name: String!
    images: [Image!]!
    releaseDate: String!
    totalTracks: Int
  }

  type Image {
    url: String!
    height: Int
    width: Int
  }

  type SearchResult {
    tracks: [Track!]!
    albums: [Album!]!
    artists: [Artist!]!
    playlists: [Playlist!]!
  }

  type Playlist {
    id: ID!
    name: String!
    description: String
    owner: User!
    tracks: [Track!]!
    images: [Image!]!
    public: Boolean
  }

  type User {
    id: ID!
    displayName: String!
    email: String
    images: [Image!]!
    level: Int
    xp: Int
  }

  type UserSession {
    userId: ID!
    displayName: String!
    expiresAt: Float!
    isValid: Boolean!
  }

  type DownloadTask {
    id: ID!
    track: Track!
    status: String!
    progress: Float!
    speed: Float!
    filePath: String
    error: String
    startedAt: String
    completedAt: String
  }

  type DownloadStats {
    queued: Int!
    active: Int!
    completed: Int!
    failed: Int!
  }

  type DownloadProgress {
    taskId: ID!
    trackId: ID!
    progress: Float!
    speed: Float!
    status: String!
  }

  type UserXP {
    userId: ID!
    currentXP: Int!
    level: Int!
    totalDownloads: Int!
    streakDays: Int!
    title: String!
  }

  type XPEvent {
    userId: ID!
    points: Int!
    level: Int!
    leveledUp: Boolean!
  }

  type Badge {
    id: ID!
    name: String!
    description: String!
    icon: String!
    rarity: String!
    awardedAt: String
  }

  type BadgeEvent {
    userId: ID!
    badgeId: ID!
    badgeName: String!
    rarity: String!
  }

  type VisualizationResult {
    filePath: String!
    mode: String!
    duration: Float!
    frames: Int!
  }
`;
