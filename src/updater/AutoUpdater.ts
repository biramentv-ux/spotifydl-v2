import axios from 'axios';
import { compare } from 'semver';
import { logger } from '../core/Logger';
import { eventBus } from '../core/EventBus';

export interface ReleaseInfo {
  version: string;
  url: string;
  changelog: string;
  publishedAt: string;
  size: number;
}

export class AutoUpdater {
  private currentVersion: string;
  private repo: string;
  private checkInterval: number;
  private intervalId: NodeJS.Timeout | null = null;
  private lastCheck: Date | null = null;
  private latestRelease: ReleaseInfo | null = null;

  constructor(
    currentVersion: string = '2.0.0',
    repo: string = 'spotifydl/spotifydl-v2',
    checkInterval: number = 86400000
  ) {
    this.currentVersion = currentVersion;
    this.repo = repo;
    this.checkInterval = checkInterval;
  }

  async check(): Promise<ReleaseInfo | null> {
    try {
      logger.info('🔍 Checking for updates...');

      const response = await axios.get(
        `https://api.github.com/repos/${this.repo}/releases/latest`,
        { timeout: 10000 }
      );

      const release = response.data;
      const latestVersion = release.tag_name.replace(/^v/, '');

      this.lastCheck = new Date();

      if (compare(latestVersion, this.currentVersion) > 0) {
        this.latestRelease = {
          version: latestVersion,
          url: release.html_url,
          changelog: release.body || 'No changelog available',
          publishedAt: release.published_at,
          size: release.assets?.[0]?.size || 0
        };

        logger.info(`⬆️ Update available: ${this.currentVersion} -> ${latestVersion}`);
        eventBus.emit('plugin:lifecycle', {
          pluginId: 'updater',
          type: 'loaded'
        });

        return this.latestRelease;
      }

      logger.info('✅ Already on latest version');
      return null;
    } catch (error) {
      logger.error('Update check failed', { error });
      return null;
    }
  }

  startAutoCheck(): void {
    if (this.intervalId) return;
    this.check();
    this.intervalId = setInterval(() => {
      this.check();
    }, this.checkInterval);
    logger.info(`⏰ Auto-updater started (interval: ${this.checkInterval / 3600000}h)`);
  }

  stopAutoCheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('⏰ Auto-updater stopped');
    }
  }

  async downloadUpdate(): Promise<Buffer | null> {
    if (!this.latestRelease) {
      logger.warn('No update available to download');
      return null;
    }

    try {
      logger.info(`⬇️ Downloading update ${this.latestRelease.version}...`);

      const response = await axios.get(this.latestRelease.url, {
        responseType: 'arraybuffer',
        timeout: 300000
      });

      logger.info(`✅ Update downloaded: ${this.formatBytes(response.data.length)}`);
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Update download failed', { error });
      return null;
    }
  }

  getStatus(): {
    currentVersion: string;
    latestVersion: string | null;
    updateAvailable: boolean;
    lastCheck: Date | null;
    nextCheck: Date | null;
  } {
    return {
      currentVersion: this.currentVersion,
      latestVersion: this.latestRelease?.version || null,
      updateAvailable: !!this.latestRelease,
      lastCheck: this.lastCheck,
      nextCheck: this.intervalId
        ? new Date(Date.now() + this.checkInterval)
        : null
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
