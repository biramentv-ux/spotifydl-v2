import request from 'supertest';
import express, { Application } from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from '../../src/graphql/typeDefs';
import { resolvers } from '../../src/graphql/resolvers';
import { GraphQLServer, GraphQLContext } from '../../src/graphql/GraphQLServer';
import { AuthManager } from '../../src/auth/AuthManager';
import { DownloadManager } from '../../src/download/DownloadManager';
import { SpotifyAPI } from '../../src/core/SpotifyAPI';
import { ConfigManager } from '../../src/core/ConfigManager';

// Mock external dependencies
jest.mock('../../src/core/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn()
  }
}));

jest.mock('../../src/core/EventBus', () => ({
  eventBus: {
    emit: jest.fn()
  }
}));

describe('GraphQL Integration', () => {
  let app: Application;
  let apolloServer: ApolloServer<GraphQLContext>;
  let downloadManager: DownloadManager;
  let authManager: AuthManager;
  let spotifyAPI: SpotifyAPI;
  let config: ConfigManager;

  beforeAll(async () => {
    config = {
      get: jest.fn().mockImplementation((key: string) => {
        const configMap: Record<string, any> = {
          download: { concurrency: 3, outputDir: './downloads', format: 'mp3', quality: 'high' },
          spotify: { clientId: 'test', clientSecret: 'test', redirectUri: 'http://localhost:3000/callback', scopes: ['user-read-private'] }
        };
        return configMap[key];
      })
    } as any;

    const engine = {
      download: jest.fn().mockResolvedValue('/downloads/test.mp3')
    } as any;

    downloadManager = new DownloadManager(config, engine);
    authManager = new AuthManager(config);
    spotifyAPI = new SpotifyAPI();

    // Mock SpotifyAPI methods for GraphQL tests
    jest.spyOn(spotifyAPI, 'getTrack').mockResolvedValue({
      id: 'track123',
      name: 'GraphQL Test Track',
      artists: [{ id: 'artist1', name: 'Test Artist' }],
      album: { id: 'album1', name: 'Test Album', images: [], release_date: '2024-01-01' },
      duration_ms: 180000,
      explicit: false,
      popularity: 80,
      preview_url: null,
      track_number: 1
    } as any);

    jest.spyOn(spotifyAPI, 'search').mockResolvedValue({
      tracks: { items: [] },
      albums: { items: [] },
      artists: { items: [] },
      playlists: { items: [] }
    } as any);

    apolloServer = new ApolloServer<GraphQLContext>({
      typeDefs,
      resolvers,
      plugins: [],
      formatError: (error) => error
    });

    await apolloServer.start();

    app = express();
    app.use(express.json());
    app.use('/graphql', expressMiddleware(apolloServer, {
      context: async (): Promise<GraphQLContext> => ({
        authManager,
        downloadManager,
        spotifyAPI,
        userId: undefined
      })
    }));
  });

  afterAll(async () => {
    await apolloServer.stop();
  });

  describe('Query: health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({ query: '{ health { status uptime timestamp } }' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.data.health.status).toBe('ok');
      expect(typeof response.body.data.health.uptime).toBe('number');
      expect(typeof response.body.data.health.timestamp).toBe('string');
    });
  });

  describe('Query: downloadStats', () => {
    it('should return download statistics', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({ query: '{ downloadStats { queued active completed failed } }' })
        .expect(200);

      expect(response.body.data.downloadStats).toEqual({
        queued: 0,
        active: 0,
        completed: 0,
        failed: 0
      });
    });
  });

  describe('Query: downloadQueue', () => {
    it('should return empty queue initially', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({ query: '{ downloadQueue { id status progress } }' })
        .expect(200);

      expect(response.body.data.downloadQueue).toEqual([]);
    });
  });

  describe('Query: track', () => {
    it('should return track details', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({ query: '{ track(id: "track123") { id name artists { name } } }' })
        .expect(200);

      expect(response.body.data.track.id).toBe('track123');
      expect(response.body.data.track.name).toBe('GraphQL Test Track');
    });
  });

  describe('Query: search', () => {
    it('should return search results', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({ query: '{ search(query: "test") { tracks { items { id name } } } }' })
        .expect(200);

      expect(response.body.data.search).toBeDefined();
      expect(response.body.data.search.tracks).toBeDefined();
    });
  });

  describe('Query: me (unauthenticated)', () => {
    it('should return null when not authenticated', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({ query: '{ me { id displayName } }' })
        .expect(200);

      expect(response.body.data.me).toBeNull();
    });
  });

  describe('Query: leaderboard', () => {
    it('should return empty leaderboard', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({ query: '{ leaderboard(limit: 10) { userId level currentXP } }' })
        .expect(200);

      expect(Array.isArray(response.body.data.leaderboard)).toBe(true);
    });
  });

  describe('Mutation: queueDownload', () => {
    it('should queue a download and return task', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation {
              queueDownload(trackId: "track123") {
                id
                status
                track { name }
              }
            }
          `
        })
        .expect(200);

      expect(response.body.data.queueDownload.id).toBeDefined();
      expect(['queued', 'downloading', 'processing', 'completed']).toContain(response.body.data.queueDownload.status);
      expect(response.body.data.queueDownload.track.name).toBe('GraphQL Test Track');
    });
  });

  describe('Mutation: cancelDownload', () => {
    it('should return false for non-existent task', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation {
              cancelDownload(taskId: "non-existent")
            }
          `
        })
        .expect(200);

      expect(response.body.data.cancelDownload).toBe(false);
    });
  });

  describe('Mutation: clearHistory', () => {
    it('should clear completed downloads', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation {
              clearHistory
            }
          `
        })
        .expect(200);

      expect(response.body.data.clearHistory).toBe(true);
    });
  });

  describe('Complex query with multiple fields', () => {
    it('should handle complex nested queries', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({
          query: `
            query {
              health { status uptime }
              downloadStats { queued active }
              downloadQueue { id status progress track { name artists { name } } }
            }
          `
        })
        .expect(200);

      expect(response.body.data.health.status).toBe('ok');
      expect(response.body.data.downloadStats.queued).toBe(0);
      expect(response.body.data.downloadQueue).toEqual([]);
    });
  });
});
