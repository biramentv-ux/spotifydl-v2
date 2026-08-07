import fs from 'fs/promises';
import path from 'path';
import { logger } from './Logger';

export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

export interface TelegramConfig {
  botToken: string;
  webhookUrl: string;
  adminChatId: string;
}

export interface CloudConfig {
  googleDrive: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  dropbox: {
    accessToken: string;
  };
}

export interface DownloadConfig {
  concurrency: number;
  outputDir: string;
  format: 'mp3' | 'flac' | 'ogg';
  quality: 'low' | 'medium' | 'high';
}

export interface AppConfig {
  spotify: SpotifyConfig;
  neo4j: Neo4jConfig;
  telegram: TelegramConfig;
  cloud: CloudConfig;
  download: DownloadConfig;
  visualizer: {
    enabled: boolean;
    defaultMode: string;
    ffmpegPath: string;
  };
  plugins: {
    enabled: boolean;
    directory: string;
    timeout: number;
  };
  server: {
    port: number;
    host: string;
    cors: {
      origin: string;
      methods: string[];
    };
  };
  xp: {
    baseThreshold: number;
    multiplier: number;
    dailyBonus: number;
  };
  updater: {
    checkInterval: number;
    autoUpdate: boolean;
    channel: 'stable' | 'beta' | 'dev';
  };
}

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor(configPath: string = 'config/default.json') {
    this.configPath = path.resolve(configPath);
    this.config = this.getDefaultConfig();
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const fileConfig = JSON.parse(data);
      this.config = this.mergeDeep(this.config, fileConfig);
      logger.info('Configuration loaded', { path: this.configPath });
    } catch (error) {
      logger.warn('Using default configuration', { error });
    }
    this.applyEnvOverrides();
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
  }

  private applyEnvOverrides(): void {
    const envMap: Record<string, { path: string; type: 'string' | 'number' | 'boolean' }> = {
      'SPOTIFY_CLIENT_ID': { path: 'spotify.clientId', type: 'string' },
      'SPOTIFY_CLIENT_SECRET': { path: 'spotify.clientSecret', type: 'string' },
      'NEO4J_URI': { path: 'neo4j.uri', type: 'string' },
      'NEO4J_PASSWORD': { path: 'neo4j.password', type: 'string' },
      'TELEGRAM_BOT_TOKEN': { path: 'telegram.botToken', type: 'string' },
      'SERVER_PORT': { path: 'server.port', type: 'number' }
    };

    for (const [envKey, { path: configPath, type }] of Object.entries(envMap)) {
      const rawValue = process.env[envKey];
      if (rawValue) {
        let value: any = rawValue;
        if (type === 'number') {
          const parsed = parseInt(rawValue, 10);
          if (!isNaN(parsed)) value = parsed;
        }
        this.setNestedValue(this.config, configPath, value);
        logger.debug(`Override from env: ${envKey}`);
      }
    }
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  private mergeDeep(target: any, source: any): any {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      for (const key of Object.keys(source)) {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      }
    }
    return output;
  }

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  private getDefaultConfig(): AppConfig {
    return {
      spotify: {
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['user-read-private', 'user-read-email', 'playlist-read-private', 'user-library-read']
      },
      neo4j: {
        uri: 'bolt://localhost:7687',
        user: 'neo4j',
        password: ''
      },
      telegram: {
        botToken: '',
        webhookUrl: '',
        adminChatId: ''
      },
      cloud: {
        googleDrive: {
          clientId: '',
          clientSecret: '',
          redirectUri: ''
        },
        dropbox: {
          accessToken: ''
        }
      },
      download: {
        concurrency: 3,
        outputDir: './downloads',
        format: 'mp3',
        quality: 'high'
      },
      visualizer: {
        enabled: true,
        defaultMode: 'waveform',
        ffmpegPath: 'ffmpeg'
      },
      plugins: {
        enabled: true,
        directory: './plugins',
        timeout: 5000
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
        cors: {
          origin: '*',
          methods: ['GET', 'POST', 'PUT', 'DELETE']
        }
      },
      xp: {
        baseThreshold: 100,
        multiplier: 1.5,
        dailyBonus: 50
      },
      updater: {
        checkInterval: 86400000,
        autoUpdate: false,
        channel: 'stable'
      }
    };
  }
}

export const configManager = new ConfigManager();
