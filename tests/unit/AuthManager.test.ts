import { AuthManager } from '../../src/auth/AuthManager';
import { ConfigManager } from '../../src/core/ConfigManager';
import jwt from 'jsonwebtoken';

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

describe('AuthManager', () => {
  let authManager: AuthManager;
  let mockConfig: ConfigManager;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn().mockReturnValue({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['user-read-private']
      })
    } as any;

    authManager = new AuthManager(mockConfig);
  });

  describe('getAuthUrl', () => {
    it('should generate a valid Spotify auth URL', () => {
      const url = authManager.getAuthUrl('test-state');
      expect(url).toContain('accounts.spotify.com/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=test-state');
    });

    it('should generate a random state if not provided', () => {
      const url = authManager.getAuthUrl();
      expect(url).toContain('state=');
    });
  });

  describe('validateToken', () => {
    it('should validate a correct JWT token', () => {
      const token = jwt.sign(
        { userId: 'user123', accessToken: 'token123' },
        'spotify-dl-secret-change-in-production'
      );
      const result = authManager.validateToken(token);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user123');
    });

    it('should return null for an invalid token', () => {
      const result = authManager.validateToken('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('isSessionValid', () => {
    it('should return false for non-existent session', () => {
      expect(authManager.isSessionValid('non-existent')).toBe(false);
    });
  });
});
