import { createReadStream, statSync } from 'fs';
import { logger } from '../core/Logger';

export interface StreamOptions {
  start?: number;
  end?: number;
  chunkSize?: number;
}

export class AudioStream {
  private chunkSize: number = 64 * 1024; // 64KB chunks

  async streamFile(filePath: string, options: StreamOptions = {}): Promise<{
    stream: NodeJS.ReadableStream;
    size: number;
    range: { start: number; end: number };
  }> {
    const stats = statSync(filePath);
    const fileSize = stats.size;

    const start = options.start || 0;
    const end = options.end || fileSize - 1;
    const actualEnd = Math.min(end, fileSize - 1);

    const stream = createReadStream(filePath, {
      start,
      end: actualEnd,
      highWaterMark: this.chunkSize
    });

    logger.debug(`Streaming ${filePath} [${start}-${actualEnd}/${fileSize}]`);

    return {
      stream,
      size: fileSize,
      range: { start, end: actualEnd }
    };
  }

  parseRangeHeader(rangeHeader: string | undefined, fileSize: number): { start: number; end: number } | null {
    if (!rangeHeader) return null;

    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return null;

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      return null;
    }

    return { start, end };
  }

  getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
      mp3: 'audio/mpeg',
      flac: 'audio/flac',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      wav: 'audio/wav',
      aac: 'audio/aac'
    };
    return types[ext || ''] || 'application/octet-stream';
  }
}
