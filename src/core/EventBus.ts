import { EventEmitter } from 'events';
import { logger } from './Logger';

export interface DownloadProgressEvent {
  trackId: string;
  progress: number;
  speed: number;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed';
}

export interface XPEvent {
  userId: string;
  points: number;
  level: number;
  leveledUp: boolean;
}

export interface BadgeEvent {
  userId: string;
  badgeId: string;
  badgeName: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface AuthEvent {
  userId: string;
  type: 'login' | 'logout' | 'refresh' | 'expire';
  token?: string;
}

export interface PluginEvent {
  pluginId: string;
  type: 'loaded' | 'enabled' | 'disabled' | 'error';
  error?: Error;
}

type EventMap = {
  'download:progress': DownloadProgressEvent;
  'download:complete': { trackId: string; filePath: string };
  'download:error': { trackId: string; error: Error };
  'xp:gain': XPEvent;
  'badge:award': BadgeEvent;
  'auth:change': AuthEvent;
  'plugin:lifecycle': PluginEvent;
  'system:shutdown': void;
};

export class EventBus {
  private emitter = new EventEmitter();

  on<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.emitter.on(event, listener);
  }

  off<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.emitter.off(event, listener);
  }

  emit<K extends keyof EventMap>(event: K, data?: EventMap[K]): void {
    logger.debug(`Event emitted: ${event}`, { data });
    this.emitter.emit(event, data);
  }

  once<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.emitter.once(event, listener);
  }

  removeAllListeners(event?: keyof EventMap): void {
    this.emitter.removeAllListeners(event);
  }
}

export const eventBus = new EventBus();
