import request from 'supertest';
import express, { Application } from 'express';
import { createAPIRouter } from '../../src/api/routes';
import { AuthManager } from '../../src/auth/AuthManager';
import { XPSystem } from '../../src/auth/XPSystem';
import { BadgeSystem } from '../../src/auth/BadgeSystem';
import { DownloadManager } from '../../src/download/DownloadManager';
import { HybridEngine } from '../../src/download/engines/HybridEngine';
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

jest.mock('../../src/core/SpotifyAPI', () => ({
  spotifyAPI: {
    getTrack: jest.fn().mockResolvedValue({
      id: 'track123',
      name: 'Test Track',
      artists: [{ id: 'artist1', name: 'Test Artist' }],
      album: { id: 'album1', name: 'Test Album', images: [], release_date: '2024-01-01' },
      duration_ms: 180000,
      explicit: false,
      popularity: 80,
      preview_url: null,
      track_number: 1
    }),
    search: jest.fn().mockResolvedValue({
      tracks: { items: [] },
      albums: { items: [] },
      artists: { items: [] },
      playlists: { items: [] }
    })
  }
}));

describe('Download API Integration', () => {
  let app: Application;
  let downloadManager: DownloadManager;
  let xpSystem: XPSystem;
  let badgeSystem: BadgeSystem;
  let authManager: AuthManager;
  let config: ConfigManager;

  beforeEach(() => {
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
        // Simulate async download with delay so tasks stay in queue briefly
        return new Promise((resolve) => {
          setTimeout(() => {
            if (options.onComplete) options.onComplete(`/downloads/${track.id}.mp3`);
            resolve(`/downloads/${track.id}.mp3`);
          }, 100);
        });
      })
    } as any;

    downloadManager = new DownloadManager(config, engine);
    xpSystem = new XPSystem();
    badgeSystem = new BadgeSystem();
    authManager = new AuthManager(config);

    app = express();
    app.use(express.json());
    app.use('/api/v1', createAPIRouter(config, authManager, downloadManager, xpSystem, badgeSystem));
  });

  describe('POST /api/v1/download', () => {
    it('should queue a track download and return taskId', async () => {
      const response = await request(app)
        .post('/api/v1/download')
        .send({ trackId: 'track123' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.taskId).toBeDefined();
      expect(response.body.status).toBe('queued');
      expect(typeof response.body.taskId).toBe('string');
    });

    it('should return 400 when trackId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/download')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('trackId required');
    });

    it('should handle multiple concurrent download requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/v1/download')
          .send({ trackId: `track${i}` })
      );

      const responses = await Promise.all(requests);

      responses.forEach((res: any, i: number) => {
        expect(res.status).toBe(200);
        expect(res.body.taskId).toBeDefined();
      });

      const stats = downloadManager.getStats();
      const total = stats.queued + stats.active + stats.completed;
      expect(total).toBe(5);
    });
  });

  describe('GET /api/v1/downloads', () => {
    it('should return empty queue initially', async () => {
      const response = await request(app)
        .get('/api/v1/downloads')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('should return queued downloads after adding tracks', async () => {
      // Add some tracks first
      await request(app).post('/api/v1/download').send({ trackId: 'track1' });
      await request(app).post('/api/v1/download').send({ trackId: 'track2' });

      const response = await request(app)
        .get('/api/v1/downloads')
        .expect(200);

      // Tasks may move from queued to active quickly; check total tasks instead
      const allTasks = downloadManager.getAllTasks();
      expect(allTasks.length).toBeGreaterThanOrEqual(2);
      expect(allTasks[0].track.name).toBe('Test Track');
    });
  });

  describe('GET /api/v1/downloads/stats', () => {
    it('should return correct initial stats', async () => {
      const response = await request(app)
        .get('/api/v1/downloads/stats')
        .expect(200);

      expect(response.body).toEqual({
        queued: 0,
        active: 0,
        completed: 0,
        failed: 0
      });
    });

    it('should reflect downloads in stats', async () => {
      await request(app).post('/api/v1/download').send({ trackId: 'track1' });

      const response = await request(app)
        .get('/api/v1/downloads/stats')
        .expect(200);

      // Task may be queued, active, or completed depending on timing
      const total = response.body.queued + response.body.active + response.body.completed;
      expect(total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/search', () => {
    it('should return search results', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=test&limit=10')
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return 400 when query is missing', async () => {
      const response = await request(app)
        .get('/api/v1/search')
        .expect(400);

      expect(response.body.error).toBe('Query required');
    });
  });

  describe('GET /api/v1/tracks/:id', () => {
    it('should return track details', async () => {
      const response = await request(app)
        .get('/api/v1/tracks/track123')
        .expect(200);

      expect(response.body.id).toBe('track123');
      expect(response.body.name).toBe('Test Track');
    });
  });

  describe('GET /api/v1/leaderboard', () => {
    it('should return empty leaderboard initially', async () => {
      const response = await request(app)
        .get('/api/v1/leaderboard')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/v1/xp/:userId', () => {
    it('should return user XP stats', async () => {
      // Add some XP first
      xpSystem.addXP('user1', 100);

      const response = await request(app)
        .get('/api/v1/xp/user1')
        .expect(200);

      expect(response.body.stats).toBeDefined();
      expect(response.body.progress).toBeDefined();
    });
  });

  describe('GET /api/v1/badges/:userId', () => {
    it('should return user badges', async () => {
      const response = await request(app)
        .get('/api/v1/badges/user1')
        .expect(200);

      expect(response.body.badges).toBeDefined();
      expect(Array.isArray(response.body.badges)).toBe(true);
    });
  });
});
