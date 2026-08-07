import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../../core/Logger';
import { SpotifyTrack } from '../../core/SpotifyAPI';
import { SpotifyAudioAPI, AudioStreamInfo } from '../../core/SpotifyAudioAPI';
import { DownloadOptions } from './HybridEngine';

let unplayplay: { deobfuscateKey: (fileId: string, key: string) => string } | null = null;
try {
  unplayplay = require('../../../build/Release/unplayplay_native');
  logger.info('Native unplayplay module loaded');
} catch (e) {
  logger.warn('Native unplayplay module not available');
}

export class PlayPlayEngine {
  private readonly CHUNK_SIZE = 256 * 1024;
  private readonly audioAPI = new SpotifyAudioAPI();

  async download(
    track: SpotifyTrack,
    options: DownloadOptions = {},
    accessToken?: string
  ): Promise<string> {
    const { onProgress, onComplete, format = 'mp3', quality = 'high' } = options;
    if (!accessToken) {
      throw new Error('Access token required for PlayPlay download');
    }
    const streamInfo = await this.audioAPI.getAudioStreamInfo(track.id, accessToken);
    const decryptedKey = this.deriveKey(streamInfo);
    const outputPath = await this.downloadAndDecrypt(track, streamInfo, decryptedKey, onProgress);
    if (onComplete) onComplete(outputPath);
    return outputPath;
  }

  private deriveKey(streamInfo: AudioStreamInfo): Buffer {
    if (!unplayplay) {
      throw new Error('Native unplayplay module required for key derivation');
    }
    const boundKeyHex = unplayplay.deobfuscateKey(streamInfo.fileId, streamInfo.obfuscatedKey);
    return Buffer.from(boundKeyHex, 'hex');
  }

  private async downloadAndDecrypt(
    track: SpotifyTrack,
    streamInfo: AudioStreamInfo,
    key: Buffer,
    onProgress?: (progress: number, speed: number, downloaded: number, total: number) => void
  ): Promise<string> {
    const sanitizedName = this.sanitizeFileName(`${track.artists[0].name} - ${track.name}`);
    const outputDir = './downloads';
    const outputPath = path.join(outputDir, `${sanitizedName}.ogg`);
    await fs.mkdir(outputDir, { recursive: true });

    const headResponse = await this.audioAPI.head(streamInfo.streamUrl);
    const totalSize = parseInt(headResponse.headers['content-length'] || '0');
    let downloaded = 0;
    const startTime = Date.now();
    const fileHandle = await fs.open(outputPath, 'w');

    try {
      for (let offset = 0; offset < totalSize; offset += this.CHUNK_SIZE) {
        const chunkSize = Math.min(this.CHUNK_SIZE, totalSize - offset);
        const encryptedChunk = await this.audioAPI.fetchChunk(streamInfo.streamUrl, offset, chunkSize);
        const nonce = this.deriveNonce(streamInfo.fileId, offset);
        const decryptedChunk = this.decryptChunk(encryptedChunk, key, nonce);
        await fileHandle.write(decryptedChunk, 0, decryptedChunk.length, offset);
        downloaded += chunkSize;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? downloaded / elapsed : 0;
        const progress = totalSize > 0 ? (downloaded / totalSize) * 100 : 0;
        if (onProgress) {
          onProgress(progress, speed, downloaded, totalSize);
        }
      }
    } finally {
      await fileHandle.close();
    }

    logger.info(`PlayPlay: Downloaded ${track.name} (${this.formatBytes(downloaded)})`);
    return outputPath;
  }

  private deriveNonce(fileId: string, offset: number): Buffer {
    const fileIdBytes = Buffer.from(fileId.substring(0, 16), 'hex');
    const offsetBytes = Buffer.alloc(8);
    offsetBytes.writeBigUInt64LE(BigInt(offset), 0);
    return Buffer.concat([fileIdBytes, offsetBytes]);
  }

  private decryptChunk(encrypted: Buffer, key: Buffer, nonce: Buffer): Buffer {
    const decipher = crypto.createDecipheriv('aes-128-ctr', key, nonce);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[<> : "/\\|?*]/g, '_').substring(0, 200);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
