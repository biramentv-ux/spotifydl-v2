import { logger } from '../core/Logger';
import { GoogleDrive } from './GoogleDrive';
import { Dropbox } from './Dropbox';

export interface UploadResult {
  success: boolean;
  provider: string;
  fileId?: string;
  url?: string;
  error?: string;
}

export interface CloudConfig {
  googleDrive?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  dropbox?: {
    accessToken: string;
  };
}

export class CloudUploader {
  private googleDrive?: GoogleDrive;
  private dropbox?: Dropbox;
  private providers: Map<string, any> = new Map();

  constructor(config: CloudConfig) {
    if (config.googleDrive?.clientId) {
      this.googleDrive = new GoogleDrive(config.googleDrive);
      this.providers.set('googleDrive', this.googleDrive);
    }

    if (config.dropbox?.accessToken) {
      this.dropbox = new Dropbox(config.dropbox);
      this.providers.set('dropbox', this.dropbox);
    }
  }

  async uploadFile(filePath: string, provider: string = 'auto'): Promise<UploadResult> {
    const targetProvider = provider === 'auto' ? this.getBestProvider() : provider;

    if (!this.providers.has(targetProvider)) {
      return {
        success: false,
        provider: targetProvider,
        error: `Provider ${targetProvider} not configured`
      };
    }

    try {
      logger.info(`☁️ Uploading to ${targetProvider}: ${filePath}`);
      const result = await this.providers.get(targetProvider).upload(filePath);

      logger.info(`✅ Uploaded to ${targetProvider}: ${result.fileId || result.url}`);
      return {
        success: true,
        provider: targetProvider,
        fileId: result.fileId,
        url: result.url
      };
    } catch (error: any) {
      logger.error(`Upload to ${targetProvider} failed`, { error });
      return {
        success: false,
        provider: targetProvider,
        error: error.message
      };
    }
  }

  async uploadMultiple(filePaths: string[], provider: string = 'auto'): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const filePath of filePaths) {
      const result = await this.uploadFile(filePath, provider);
      results.push(result);
    }

    return results;
  }

  private getBestProvider(): string {
    // Prefer Google Drive, fallback to Dropbox
    if (this.googleDrive) return 'googleDrive';
    if (this.dropbox) return 'dropbox';
    return 'none';
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  isConfigured(provider: string): boolean {
    return this.providers.has(provider);
  }
}
