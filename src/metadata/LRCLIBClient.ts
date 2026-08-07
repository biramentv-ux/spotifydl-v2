import axios from 'axios';
import { logger } from '../core/Logger';

export interface LRCLIBLyrics {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string;
  syncedLyrics: string | null;
}

export interface SyncedLine {
  time: number;
  text: string;
}

export class LRCLIBClient {
  private baseURL = 'https://lrclib.net/api';
  private cache: Map<string, { data: LRCLIBLyrics; expiresAt: number }> = new Map();
  private cacheTTL = 1000 * 60 * 60 * 24; // 24 hours

  async getLyrics(trackName: string, artistName: string, albumName?: string, duration?: number): Promise<LRCLIBLyrics | null> {
    const cacheKey = `${artistName}-${trackName}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug(`Cache hit for lyrics: ${trackName}`);
      return cached.data;
    }

    try {
      const params: Record<string, string | number> = {
        track_name: trackName,
        artist_name: artistName
      };
      
      if (albumName) params.album_name = albumName;
      if (duration) params.duration = duration;

      const response = await axios.get(`${this.baseURL}/get`, {
        params,
        timeout: 10000
      });

      if (response.data && response.data.plainLyrics) {
        const lyrics: LRCLIBLyrics = {
          id: response.data.id,
          trackName: response.data.trackName,
          artistName: response.data.artistName,
          albumName: response.data.albumName,
          duration: response.data.duration,
          instrumental: response.data.instrumental,
          plainLyrics: response.data.plainLyrics,
          syncedLyrics: response.data.syncedLyrics
        };

        this.cache.set(cacheKey, {
          data: lyrics,
          expiresAt: Date.now() + this.cacheTTL
        });

        logger.debug(`Lyrics fetched: ${trackName} (${lyrics.syncedLyrics ? 'synced' : 'plain'})`);
        return lyrics;
      }

      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`No lyrics found for: ${trackName}`);
        return null;
      }
      logger.warn(`LRCLIB request failed for ${trackName}`, { error: error.message });
      return null;
    }
  }

  parseSyncedLyrics(syncedLyrics: string): SyncedLine[] {
    const lines: SyncedLine[] = [];
    const regex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/gm;
    let match;

    while ((match = regex.exec(syncedLyrics)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
      const time = (minutes * 60 + seconds) * 1000 + milliseconds;
      const text = match[4].trim();

      if (text) {
        lines.push({ time, text });
      }
    }

    return lines;
  }

  formatSyncedLyrics(lines: SyncedLine[]): string {
    return lines.map(line => {
      const totalMs = line.time;
      const minutes = Math.floor(totalMs / 60000);
      const seconds = Math.floor((totalMs % 60000) / 1000);
      const ms = Math.floor(totalMs % 1000);
      return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}]${line.text}`;
    }).join('\n');
  }

  clearCache(): void {
    this.cache.clear();
    logger.debug('LRCLIB cache cleared');
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}
