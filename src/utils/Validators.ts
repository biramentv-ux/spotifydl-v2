import { logger } from '../core/Logger';

export class Validators {
  static isValidSpotifyId(id: string): boolean {
    return /^[a-zA-Z0-9]{22}$/.test(id);
  }

  static isValidSpotifyUrl(url: string): { type: 'track' | 'playlist' | 'album' | 'artist' | null; id: string | null } {
    const patterns = {
      track: /spotify\.com\/(?:track|embed)\/([a-zA-Z0-9]{22})/,
      playlist: /spotify\.com\/(?:playlist|embed\/playlist)\/([a-zA-Z0-9]{22})/,
      album: /spotify\.com\/(?:album|embed\/album)\/([a-zA-Z0-9]{22})/,
      artist: /spotify\.com\/(?:artist|embed\/artist)\/([a-zA-Z0-9]{22})/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      const match = url.match(pattern);
      if (match) {
        return { type: type as any, id: match[1] };
      }
    }

    return { type: null, id: null };
  }

  static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isValidAudioFormat(format: string): boolean {
    return ['mp3', 'flac', 'ogg', 'm4a', 'wav'].includes(format.toLowerCase());
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .trim()
      .substring(0, 1000);
  }

  static validateConfig(config: any): string[] {
    const errors: string[] = [];

    if (!config.spotify?.clientId) {
      errors.push('Spotify client ID is required');
    }

    if (!config.spotify?.clientSecret) {
      errors.push('Spotify client secret is required');
    }

    if (config.download?.concurrency < 1 || config.download?.concurrency > 10) {
      errors.push('Download concurrency must be between 1 and 10');
    }

    return errors;
  }

  static isValidISRC(isrc: string): boolean {
    return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc);
  }

  static isValidUPC(upc: string): boolean {
    return /^\d{12,14}$/.test(upc);
  }
}
