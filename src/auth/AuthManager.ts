import axios from 'axios';
import jwt from 'jsonwebtoken';
import { logger } from '../core/Logger';
import { ConfigManager } from '../core/ConfigManager';
import { eventBus } from '../core/EventBus';

export interface UserSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  profile: {
    displayName: string;
    email: string;
    images: { url: string }[];
  };
}

export class AuthManager {
  private config: ConfigManager;
  private sessions: Map<string, UserSession> = new Map();
  private jwtSecret: string;

  constructor(config: ConfigManager) {
    this.config = config;
    this.jwtSecret = process.env.JWT_SECRET || 'spotify-dl-secret-change-in-production';
  }

  getAuthUrl(state: string = this.generateState()): string {
    const spotify = this.config.get('spotify');
    const params = new URLSearchParams({
      client_id: spotify.clientId,
      response_type: 'code',
      redirect_uri: spotify.redirectUri,
      scope: spotify.scopes.join(' '),
      state
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<UserSession> {
    const spotify = this.config.get('spotify');
    try {
      const tokenResponse = await axios.post('https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: spotify.redirectUri,
          client_id: spotify.clientId,
          client_secret: spotify.clientSecret
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      const profileResponse = await axios.get('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const profile = profileResponse.data;

      const session: UserSession = {
        userId: profile.id,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + (expires_in * 1000),
        profile: {
          displayName: profile.display_name || profile.id,
          email: profile.email,
          images: profile.images || []
        }
      };

      this.sessions.set(profile.id, session);

      const token = jwt.sign(
        { userId: session.userId, accessToken: session.accessToken },
        this.jwtSecret,
        { expiresIn: '7d' }
      );

      eventBus.emit('auth:change', {
        userId: session.userId,
        type: 'login',
        token
      });

      logger.info(`User authenticated: ${session.profile.displayName}`, {
        userId: session.userId
      });

      return session;
    } catch (error) {
      logger.error('Authentication callback failed', { error });
      throw new Error('Failed to authenticate with Spotify');
    }
  }

  async refreshSession(userId: string): Promise<UserSession> {
    const session = this.sessions.get(userId);
    if (!session) {
      throw new Error('Session not found');
    }

    const spotify = this.config.get('spotify');

    try {
      const response = await axios.post('https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: session.refreshToken,
          client_id: spotify.clientId,
          client_secret: spotify.clientSecret
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token, expires_in } = response.data;

      session.accessToken = access_token;
      session.expiresAt = Date.now() + (expires_in * 1000);

      this.sessions.set(userId, session);

      eventBus.emit('auth:change', {
        userId,
        type: 'refresh'
      });

      logger.debug(`Session refreshed for user: ${userId}`);
      return session;
    } catch (error) {
      logger.error('Session refresh failed', { userId, error });
      this.sessions.delete(userId);
      throw new Error('Failed to refresh session');
    }
  }

  validateToken(token: string): { userId: string; accessToken: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string; accessToken: string };
      return decoded;
    } catch {
      return null;
    }
  }

  getSession(userId: string): UserSession | undefined {
    return this.sessions.get(userId);
  }

  getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  async logout(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      this.sessions.delete(userId);
      eventBus.emit('auth:change', {
        userId,
        type: 'logout'
      });
      logger.info(`User logged out: ${session.profile.displayName}`);
    }
  }

  isSessionValid(userId: string): boolean {
    const session = this.sessions.get(userId);
    return !!session && session.expiresAt > Date.now();
  }

  private generateState(): string {
    return Buffer.from(Math.random().toString(36) + Date.now().toString(36)).toString('base64').substring(0, 32);
  }
}
