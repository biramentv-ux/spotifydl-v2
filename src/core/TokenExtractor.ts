import axios from 'axios';
import { logger } from './Logger';

export class TokenExtractor {
  private static readonly SPOTIFY_WEB_PLAYER = 'https://open.spotify.com';
  private static readonly TOKEN_URL = 'https://open.spotify.com/get_access_token';
  private cache: { token: string; expiresAt: number } | null = null;

  async extractAnonymousToken(): Promise<string> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      logger.debug('Using cached anonymous token');
      return this.cache.token;
    }

    try {
      const response = await axios.get(TokenExtractor.TOKEN_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      if (response.data && response.data.accessToken) {
        const token = response.data.accessToken;
        const expiresIn = response.data.expiresIn || 3600;
        
        this.cache = {
          token,
          expiresAt: Date.now() + (expiresIn * 1000) - 60000
        };

        logger.info('Anonymous token extracted successfully');
        return token;
      }

      throw new Error('No access token in response');
    } catch (error) {
      logger.warn('Failed to extract token from API, falling back to HTML scraping');
      return this.fallbackHtmlScraping();
    }
  }

  private async fallbackHtmlScraping(): Promise<string> {
    try {
      const response = await axios.get(TokenExtractor.SPOTIFY_WEB_PLAYER, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });

      const html = response.data as string;
      
      // Look for accessToken in script tags or JSON
      const tokenMatch = html.match(/"accessToken"\s*:\s*"([^"]+)"/);
      if (tokenMatch) {
        const token = tokenMatch[1];
        logger.info('Token extracted via HTML scraping');
        return token;
      }

      // Alternative pattern
      const altMatch = html.match(/accessToken["\']?\s*[:=]\s*["\']([^"\']+)["\']/);
      if (altMatch) {
        return altMatch[1];
      }

      throw new Error('Could not find token in HTML');
    } catch (error) {
      logger.error('HTML scraping failed', { error });
      throw new Error('Failed to extract anonymous token');
    }
  }

  clearCache(): void {
    this.cache = null;
    logger.debug('Token cache cleared');
  }
}

export const tokenExtractor = new TokenExtractor();
