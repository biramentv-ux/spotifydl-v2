import { Router, Request, Response } from 'express';
import { logger } from '../core/Logger';
import { SpotifyAPI } from '../core/SpotifyAPI';
import { DownloadManager } from '../download/DownloadManager';
import { AuthManager } from '../auth/AuthManager';
import { XPSystem } from '../auth/XPSystem';
import { BadgeSystem } from '../auth/BadgeSystem';
import { ConfigManager } from '../core/ConfigManager';

export function createAPIRouter(
  config: ConfigManager,
  authManager: AuthManager,
  downloadManager: DownloadManager,
  xpSystem: XPSystem,
  badgeSystem: BadgeSystem,
  spotifyAPI: SpotifyAPI
): Router {
  const router = Router();

  // Auth routes
  router.get('/auth/spotify', (_req, res) => {
    const url = authManager.getAuthUrl();
    res.json({ authUrl: url });
  });

  router.get('/auth/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }
    try {
      const session = await authManager.handleCallback(code as string, state as string);
      res.json({ success: true, user: session.profile });
    } catch (error) {
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Spotify data routes
  router.get('/tracks/:id', async (req, res) => {
    try {
      const track = await spotifyAPI.getTrack(req.params.id);
      res.json(track);
    } catch (error) {
      res.status(404).json({ error: 'Track not found' });
    }
  });

  router.get('/search', async (req, res) => {
    const { q, type = 'track', limit = 20 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    try {
      const results = await spotifyAPI.search(q as string, type as string, Number(limit));
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Download routes
  router.post('/download', async (req, res) => {
    const { trackId } = req.body;
    if (!trackId) return res.status(400).json({ error: 'trackId required' });
    try {
      // Extract and set access token for PlayPlay engine
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = authManager.validateToken(token);
        if (decoded?.userId) {
          const session = authManager.getSession(decoded.userId);
          if (session?.accessToken) {
            downloadManager.setAccessToken(session.accessToken);
          }
        }
      }
      const track = await spotifyAPI.getTrack(trackId);
      const taskId = downloadManager.addToQueue(track);
      res.json({ taskId, status: 'queued' });
    } catch (error) {
      res.status(500).json({ error: 'Download failed' });
    }
  });

  router.get('/downloads', (_req, res) => {
    res.json(downloadManager.getQueue());
  });

  router.get('/downloads/stats', (_req, res) => {
    res.json(downloadManager.getStats());
  });

  // XP & Badges
  router.get('/xp/:userId', (req, res) => {
    const stats = xpSystem.getUserStats(req.params.userId);
    const progress = xpSystem.getXPForNextLevel(req.params.userId);
    res.json({ stats, progress });
  });

  router.get('/badges/:userId', (req, res) => {
    const badges = badgeSystem.getUserBadgeDetails(req.params.userId);
    res.json({ badges });
  });

  router.get('/leaderboard', (_req, res) => {
    res.json(xpSystem.getLeaderboard(20));
  });

  return router;
}
