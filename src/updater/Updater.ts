import axios from 'axios';
import { logger } from '../core/Logger';
import { ConfigManager } from '../core/ConfigManager';

export interface UpdateInfo {
  version: string;
  url: string;
  changelog: string;
  critical: boolean;
}

export class Updater {
  private config: ConfigManager;
  private currentVersion = '2.0.0';
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config: ConfigManager) {
    this.config = config;
  }

  start(): void {
    const interval = this.config.get('updater').checkInterval;
    if (this.config.get('updater').autoUpdate) {
      this.checkInterval = setInterval(() => this.check(), interval);
      logger.info(`Auto-updater started (interval: ${interval}ms)`);
    }
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async check(): Promise<UpdateInfo | null> {
    try {
      const response = await axios.get('https://api.github.com/repos/spotify-dl/spotify-dl/releases/latest', {
        timeout: 10000
      });
      const latest = response.data.tag_name.replace('v', '');
      
      if (this.isNewer(latest, this.currentVersion)) {
        const update: UpdateInfo = {
          version: latest,
          url: response.data.html_url,
          changelog: response.data.body || '',
          critical: response.data.prerelease === false
        };
        logger.info(`Update available: ${latest}`);
        return update;
      }
      
      logger.debug('No updates available');
      return null;
    } catch (error) {
      logger.warn('Update check failed', { error });
      return null;
    }
  }

  private isNewer(latest: string, current: string): boolean {
    const parse = (v: string) => v.split('.').map(Number);
    const l = parse(latest);
    const c = parse(current);
    for (let i = 0; i < 3; i++) {
      if (l[i] > c[i]) return true;
      if (l[i] < c[i]) return false;
    }
    return false;
  }
}
