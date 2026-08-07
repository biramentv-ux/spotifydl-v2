import request from 'supertest';
import express, { Application } from 'express';
import http from 'http';
import WebSocket from 'ws';
import { createAPIRouter } from '../../src/api/routes';
import { GraphQLServer, GraphQLContext } from '../../src/graphql/GraphQLServer';
import { WebSocketServer } from '../../src/websocket/WebSocketServer';
import { AuthManager } from '../../src/auth/AuthManager';
import { XPSystem } from '../../src/auth/XPSystem';
import { BadgeSystem } from '../../src/auth/BadgeSystem';
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
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  }
}));

describe('E2E Full Flow', () => {
  let app: Application;
  let server: http.Server;
  let wsUrl: string;
  let downloadManager: DownloadManager;
  let xpSystem: XPSystem;
  let badgeSystem: BadgeSystem;
  let authManager: AuthManager;
  let spotifyAPI: SpotifyAPI;
  let config: ConfigManager;
  let graphqlServer: GraphQLServer;
  let wss: WebSocketServer;

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
      download: jest.fn().mockImplementation((track: any, options: any) => {
        // Simulate download progress
        if (options.onProgress) {
          options.onProgress(50, 1024 * 1024, 5 * 1024 * 1024, 10 * 1024 * 1024);
        }
        if (options.onComplete) {
          options.onComplete(`/downloads/${track.id}.mp3`);
        }
        return Promise.resolve(`/downloads/${track.id}.mp3`);
      })
    } as any;

    downloadManager = new DownloadManager(config, engine);
    xpSystem = new XPSystem();
    badgeSystem = new BadgeSystem();
    authManager = new AuthManager(config);
    spotifyAPI = new SpotifyAPI();

    // Mock SpotifyAPI
    jest.spyOn(spotifyAPI, 'getTrack').mockImplementation((id: string) =>
      Promise.resolve({
        id,
        name: `Track ${id}`,
        artists: [{ id: 'artist1', name: 'Test Artist' }],
        album: { id: 'album1', name: 'Test Album', images: [{ url: 'https://example.com/cover.jpg', height: 640, width: 640 }], release_date: '2024-01-01' },
        duration_ms: 180000,
        explicit: false,
        popularity: 80,
        preview_url: null,
        track_number: 1
      } as any)
    );

    jest.spyOn(spotifyAPI, 'getPlaylistTracks').mockResolvedValue([
      {
        id: 'playlist-track-1',
        name: 'Playlist Track 1',
        artists: [{ id: 'artist1', name: 'Test Artist' }],
        album: { id: 'album1', name: 'Test Album', images: [], release_date: '2024-01-01' },
        duration_ms: 180000,
        explicit: false,
        popularity: 80,
        preview_url: null,
        track_number: 1
      }
    ] as any);

    // Setup Express app
    app = express();
    app.use(express.json());

    // Health endpoint
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', uptime: process.uptime() });
    });

    // REST API
    app.use('/api/v1', createAPIRouter(config, authManager, downloadManager, xpSystem, badgeSystem, spotifyAPI));

    // GraphQL
    graphqlServer = new GraphQLServer(authManager, downloadManager, spotifyAPI);
    await graphqlServer.start();
    app.use('/graphql', graphqlServer.getMiddleware());

    // Create HTTP server for WebSocket
    server = http.createServer(app);
    wss = new WebSocketServer(server, downloadManager);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        wsUrl = `ws://127.0.0.1:${address.port}/ws`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    wss.close();
    await graphqlServer.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('Complete user journey', () => {
    it('should perform full download flow: REST API -> GraphQL -> WebSocket', async () => {
      // Step 1: Check health
      const healthResponse = await request(app).get('/health').expect(200);
      expect(healthResponse.body.status).toBe('ok');

      // Step 2: Queue download via REST API
      const downloadResponse = await request(app)
        .post('/api/v1/download')
        .send({ trackId: 'e2e-track-1' })
        .expect(200);

      expect(downloadResponse.body.taskId).toBeDefined();
      expect(downloadResponse.body.status).toBe('queued');
      const taskId = downloadResponse.body.taskId;

      // Step 3: Check queue via REST API
      const queueResponse = await request(app)
        .get('/api/v1/downloads')
        .expect(200);

      expect(queueResponse.body.length).toBeGreaterThan(0);

      // Step 4: Check stats via REST API
      const statsResponse = await request(app)
        .get('/api/v1/downloads/stats')
        .expect(200);

      expect(statsResponse.body.queued + statsResponse.body.active + statsResponse.body.completed).toBeGreaterThan(0);

      // Step 5: Query download stats via GraphQL
      const graphqlStatsResponse = await request(app)
        .post('/graphql')
        .send({ query: '{ downloadStats { queued active completed failed } }' })
        .expect(200);

      expect(graphqlStatsResponse.body.data.downloadStats).toBeDefined();

      // Step 6: Query download queue via GraphQL
      const graphqlQueueResponse = await request(app)
        .post('/graphql')
        .send({ query: '{ downloadQueue { id status progress track { name } } }' })
        .expect(200);

      expect(Array.isArray(graphqlQueueResponse.body.data.downloadQueue)).toBe(true);

      // Step 7: Connect via WebSocket
      const ws = new WebSocket(wsUrl);
      const wsMessages: any[] = [];

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          // Subscribe to downloads channel
          ws.send(JSON.stringify({ type: 'subscribe', channel: 'downloads' }));
        });

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          wsMessages.push(msg);

          if (msg.type === 'subscribed') {
            // Get queue after subscription
            ws.send(JSON.stringify({ type: 'getQueue' }));
          }

          if (msg.type === 'queue') {
            ws.close();
            resolve();
          }
        });

        ws.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      });

      // Verify WebSocket messages
      expect(wsMessages.some(m => m.type === 'connected')).toBe(true);
      expect(wsMessages.some(m => m.type === 'subscribed')).toBe(true);
      expect(wsMessages.some(m => m.type === 'queue')).toBe(true);
    });

    it('should handle XP and badge progression through downloads', async () => {
      const userId = 'e2e-user-1';

      // Initial state
      const initialXP = await request(app)
        .get(`/api/v1/xp/${userId}`)
        .expect(200);

      expect(initialXP.body.stats).toBeNull();

      // Add XP
      xpSystem.addXP(userId, 150, 'download');

      // Check updated XP
      const updatedXP = await request(app)
        .get(`/api/v1/xp/${userId}`)
        .expect(200);

      expect(updatedXP.body.stats.currentXP).toBe(150);
      expect(updatedXP.body.stats.level).toBe(2);

      // Check badges
      const badges = await request(app)
        .get(`/api/v1/badges/${userId}`)
        .expect(200);

      expect(Array.isArray(badges.body.badges)).toBe(true);

      // Check leaderboard
      const leaderboard = await request(app)
        .get('/api/v1/leaderboard')
        .expect(200);

      expect(leaderboard.body.length).toBeGreaterThan(0);
      expect(leaderboard.body[0].userId).toBe(userId);
    });

    it('should handle authentication flow', async () => {
      // Get auth URL
      const authResponse = await request(app)
        .get('/api/v1/auth/spotify')
        .expect(200);

      expect(authResponse.body.authUrl).toBeDefined();
      expect(authResponse.body.authUrl).toContain('accounts.spotify.com');

      // GraphQL: me should be null without auth
      const meResponse = await request(app)
        .post('/graphql')
        .send({ query: '{ me { id displayName } }' })
        .expect(200);

      expect(meResponse.body.data.me).toBeNull();

      // GraphQL: sessions should be empty
      const sessionsResponse = await request(app)
        .post('/graphql')
        .send({ query: '{ sessions { userId displayName } }' })
        .expect(200);

      expect(sessionsResponse.body.data.sessions).toEqual([]);
    });

    it('should handle multiple downloads and queue management', async () => {
      // Queue multiple tracks
      const trackIds = ['multi-1', 'multi-2', 'multi-3'];
      const taskIds: string[] = [];

      for (const trackId of trackIds) {
        const response = await request(app)
          .post('/api/v1/download')
          .send({ trackId })
          .expect(200);

        taskIds.push(response.body.taskId);
      }

      expect(taskIds).toHaveLength(3);
      expect(new Set(taskIds).size).toBe(3); // All unique

      // Check queue has all items
      const queueResponse = await request(app)
        .get('/api/v1/downloads')
        .expect(200);

      expect(queueResponse.body.length).toBeGreaterThanOrEqual(3);

      // GraphQL: check download history
      const historyResponse = await request(app)
        .post('/graphql')
        .send({ query: '{ downloadHistory { id status } }' })
        .expect(200);

      expect(Array.isArray(historyResponse.body.data.downloadHistory)).toBe(true);

      // Clear history via GraphQL
      const clearResponse = await request(app)
        .post('/graphql')
        .send({ query: 'mutation { clearHistory }' })
        .expect(200);

      expect(clearResponse.body.data.clearHistory).toBe(true);
    });

    it('should handle error cases gracefully', async () => {
      // Invalid track ID
      await request(app)
        .post('/api/v1/download')
        .send({ trackId: '' })
        .expect(400);

      // Missing trackId
      await request(app)
        .post('/api/v1/download')
        .send({})
        .expect(400);

      // Invalid GraphQL query - Apollo returns 400 for validation errors
      const invalidQuery = await request(app)
        .post('/graphql')
        .send({ query: '{ invalidField }' })
        .expect(400);

      expect(invalidQuery.body.errors).toBeDefined();

      // Cancel non-existent task
      const cancelResponse = await request(app)
        .post('/graphql')
        .send({ query: 'mutation { cancelDownload(taskId: "non-existent") }' })
        .expect(200);

      expect(cancelResponse.body.data.cancelDownload).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle rapid sequential requests', async () => {
      const start = Date.now();

      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/health')
          .expect(200);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 20 }, () =>
        request(app).get('/health').expect(200)
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      expect(responses).toHaveLength(20);
      responses.forEach(r => expect(r.body.status).toBe('ok'));
      expect(duration).toBeLessThan(5000);
    });
  });
});
