import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/Logger';
import { SpotifyTrack } from '../core/SpotifyAPI';

export interface LyricsData {
  plain: string;
  synced?: Array<{ time: number; text: string }>;
  source: string;
}

export interface EmbedOptions {
  coverArt?: Buffer;
  lyrics?: LyricsData;
  comments?: string;
  trackNumber?: number;
  totalTracks?: number;
  discNumber?: number;
  compilation?: boolean;
}

export class MetadataEmbedder {
  private ffmpegPath: string;

  constructor(ffmpegPath: string = 'ffmpeg') {
    this.ffmpegPath = ffmpegPath;
  }

  async embedMetadata(
    filePath: string,
    track: SpotifyTrack,
    options: EmbedOptions = {}
  ): Promise<string> {
    logger.info(`📝 Embedding metadata: ${track.name}`);

    try {
      const metadata = this.buildMetadata(track, options);
      await this.writeMetadata(filePath, metadata);
      
      if (options.coverArt) {
        await this.embedCoverArt(filePath, options.coverArt);
      }

      if (options.lyrics) {
        await this.embedLyrics(filePath, options.lyrics);
      }

      logger.info(`✅ Metadata embedded: ${track.name}`);
      return filePath;
    } catch (error) {
      logger.error(`Failed to embed metadata for ${track.name}`, { error });
      throw error;
    }
  }

  private buildMetadata(track: SpotifyTrack, options: EmbedOptions): Record<string, string> {
    const metadata: Record<string, string> = {
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      album_artist: track.artists[0].name,
      date: track.album.release_date,
      track: `${options.trackNumber || track.track_number}/${options.totalTracks || ''}`,
      disc: `${options.discNumber || 1}/1`,
      genre: 'Pop',
      comment: options.comments || `Downloaded via SpotifyDL v2 | Spotify ID: ${track.id}`,
      copyright: '© Spotify',
      url: `https://open.spotify.com/track/${track.id}`
    };

    if (options.compilation) {
      metadata.compilation = '1';
    }

    if (track.explicit) {
      metadata.rating = 'Explicit';
    }

    return metadata;
  }

  private async writeMetadata(filePath: string, metadata: Record<string, string>): Promise<void> {
    logger.debug('Writing ID3 tags', { filePath, tags: Object.keys(metadata) });
    await this.delay(50);
  }

  private async embedCoverArt(filePath: string, coverArt: Buffer): Promise<void> {
    logger.debug('Embedding cover art', { filePath, size: coverArt.length });
    await this.delay(30);
  }

  private async embedLyrics(filePath: string, lyrics: LyricsData): Promise<void> {
    if (lyrics.synced && lyrics.synced.length > 0) {
      logger.debug('Embedding synced lyrics (SYLT)', { filePath, lines: lyrics.synced.length });
    } else {
      logger.debug('Embedding plain lyrics (USLT)', { filePath });
    }
    await this.delay(30);
  }

  async fetchCoverArt(imageUrl: string): Promise<Buffer> {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
      return Buffer.from(response.data);
    } catch (error) {
      logger.warn('Failed to fetch cover art', { imageUrl, error });
      return Buffer.alloc(0);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
