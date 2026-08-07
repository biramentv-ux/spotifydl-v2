import { logger } from '../../core/Logger';
import { SpotifyTrack } from '../../core/SpotifyAPI';
import { PlayPlayEngine } from './PlayPlayEngine';
import { WidevineEngine } from './WidevineEngine';

export interface DownloadOptions {
  onProgress?: (progress: number, speed: number, downloaded: number, total: number) => void;
  onComplete?: (filePath: string) => void;
  format?: 'mp3' | 'flac' | 'ogg';
  quality?: 'low' | 'medium' | 'high';
  accessToken?: string; // Spotify access token for audio stream API
}

export interface EngineStats {
  playplaySuccess: number;
  playplayFailures: number;
  widevineSuccess: number;
  widevineFailures: number;
  fallbackSuccess: number;
}

export class HybridEngine {
  private playPlay: PlayPlayEngine;
  private widevine: WidevineEngine;
  private stats: EngineStats = {
    playplaySuccess: 0,
    playplayFailures: 0,
    widevineSuccess: 0,
    widevineFailures: 0,
    fallbackSuccess: 0
  };

  constructor() {
    this.playPlay = new PlayPlayEngine();
    this.widevine = new WidevineEngine();
  }

  async download(track: SpotifyTrack, options: DownloadOptions = {}): Promise<string> {
    const { onProgress, format = 'mp3', quality = 'high', accessToken } = options;
    
    logger.info(`Hybrid engine selecting best method for: ${track.name}`);

    // Strategy 1: Try PlayPlay first (fastest, most common)
    try {
      logger.debug('Attempting PlayPlay download...');
      const result = await this.playPlay.download(track, { onProgress, format, quality }, accessToken);
      this.stats.playplaySuccess++;
      logger.info(`PlayPlay success: ${track.name}`);
      if (options.onComplete) options.onComplete(result);
      return result;
    } catch (playPlayError) {
      this.stats.playplayFailures++;
      logger.warn(`PlayPlay failed for ${track.name}, trying Widevine...`, { playPlayError });
    }

    // Strategy 2: Fallback to Widevine
    try {
      logger.debug('Attempting Widevine download...');
      const result = await this.widevine.download(track, { onProgress, format, quality });
      this.stats.widevineSuccess++;
      logger.info(`✅ Widevine success: ${track.name}`);
      if (options.onComplete) options.onComplete(result);
      return result;
    } catch (widevineError) {
      this.stats.widevineFailures++;
      logger.error(`Widevine failed for ${track.name}`, { widevineError });
    }

    // Strategy 3: Ultimate fallback (preview URL or error)
    throw new Error(`All decryption engines failed for track: ${track.name}`);
  }

  getStats(): EngineStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      playplaySuccess: 0,
      playplayFailures: 0,
      widevineSuccess: 0,
      widevineFailures: 0,
      fallbackSuccess: 0
    };
  }

  getPreferredEngine(): string {
    const playPlayRate = this.stats.playplaySuccess / (this.stats.playplaySuccess + this.stats.playplayFailures || 1);
    const widevineRate = this.stats.widevineSuccess / (this.stats.widevineSuccess + this.stats.widevineFailures || 1);
    
    if (playPlayRate > widevineRate && this.stats.playplaySuccess > 0) {
      return 'playplay';
    } else if (widevineRate > 0) {
      return 'widevine';
    }
    return 'playplay'; // Default
  }
}
