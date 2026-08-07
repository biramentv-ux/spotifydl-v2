import axios, { AxiosInstance } from 'axios';
import { logger } from './Logger';

export interface AudioStreamInfo {
  fileId: string;
  obfuscatedKey: string;
  streamUrl: string;
  format: 'ogg_vorbis' | 'aac';
  bitrate: number;
}

export class SpotifyAudioAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Spotify/8.8.0 (Android 13)',
        'Accept': 'application/json',
      }
    });
  }

  async getAudioStreamInfo(trackId: string, accessToken: string): Promise<AudioStreamInfo> {
    try {
      const response = await this.client.get(
        `https://spclient.wg.spotify.com/metadata/4/track/${trackId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      const fileId = response.data.file?.[0]?.file_id;
      const obfuscatedKey = response.data.file?.[0]?.key;

      if (!fileId || !obfuscatedKey) {
        throw new Error('No audio file available for this track');
      }

      const streamResponse = await this.client.get(
        `https://spclient.wg.spotify.com/storage-resolve/v2/files/audio/interactive/${fileId}?version=10000000&product=9&platform=39&alt=json`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      const cdnUrl = streamResponse.data.cdnurl?.[0];
      if (!cdnUrl) {
        throw new Error('No CDN URL available');
      }

      return {
        fileId,
        obfuscatedKey,
        streamUrl: cdnUrl,
        format: 'ogg_vorbis',
        bitrate: 320
      };
    } catch (error) {
      logger.error('Failed to get audio stream info', { trackId, error });
      throw error;
    }
  }

  async fetchChunk(url: string, offset: number, length: number): Promise<Buffer> {
    const response = await this.client.get(url, {
      headers: { 'Range': `bytes=${offset}-${offset + length - 1}` },
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  }

  async head(url: string): Promise<any> {
    return this.client.head(url);
  }
}
