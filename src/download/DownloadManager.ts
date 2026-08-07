import { EventEmitter } from 'events';
import { logger } from '../core/Logger';
import { eventBus } from '../core/EventBus';
import { ConfigManager } from '../core/ConfigManager';
import { SpotifyTrack } from '../core/SpotifyAPI';
import { HybridEngine } from './engines/HybridEngine';

export interface DownloadTask {
  id: string;
  track: SpotifyTrack;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  speed: number;
  downloadedBytes: number;
  totalBytes: number;
  filePath?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export class DownloadManager extends EventEmitter {
  private queue: DownloadTask[] = [];
  private active: Map<string, DownloadTask> = new Map();
  private completed: DownloadTask[] = [];
  private engine: HybridEngine;
  private concurrency: number;
  private outputDir: string;
  private isProcessing = false;
  private accessToken?: string;

  constructor(config: ConfigManager, engine: HybridEngine) {
    super();
    const downloadConfig = config.get('download');
    this.concurrency = downloadConfig.concurrency;
    this.outputDir = downloadConfig.outputDir;
    this.engine = engine;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  addToQueue(track: SpotifyTrack): string {
    const id = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: DownloadTask = {
      id,
      track,
      status: 'queued',
      progress: 0,
      speed: 0,
      downloadedBytes: 0,
      totalBytes: 0
    };
    this.queue.push(task);
    logger.info(`📥 Queued: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`);
    this.processQueue();
    return id;
  }

  addPlaylistToQueue(tracks: SpotifyTrack[]): string[] {
    return tracks.map(track => this.addToQueue(track));
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    while (this.queue.length > 0 && this.active.size < this.concurrency) {
      const task = this.queue.shift();
      if (!task) continue;
      this.active.set(task.id, task);
      this.downloadTask(task).catch(error => {
        logger.error(`Download failed for ${task.track.name}`, { error });
        task.status = 'failed';
        task.error = error.message;
        this.active.delete(task.id);
        this.completed.push(task);
        this.emit('download:error', task);
        eventBus.emit('download:error', { trackId: task.track.id, error });
      });
    }
    this.isProcessing = false;
  }

  private async downloadTask(task: DownloadTask): Promise<void> {
    task.status = 'downloading';
    task.startedAt = new Date();
    logger.info(`⬇️ Starting download: ${task.track.name}`);
    try {
      const result = await this.engine.download(task.track, {
        onProgress: (progress, speed, downloaded, total) => {
          task.progress = progress;
          task.speed = speed;
          task.downloadedBytes = downloaded;
          task.totalBytes = total;
          this.emit('download:progress', task);
          eventBus.emit('download:progress', {
            trackId: task.track.id,
            progress,
            speed,
            status: 'downloading'
          });
        },
        onComplete: (filePath) => {
          task.status = 'completed';
          task.filePath = filePath;
          task.completedAt = new Date();
          task.progress = 100;
          this.active.delete(task.id);
          this.completed.push(task);
          logger.info(`✅ Completed: ${task.track.name} -> ${filePath}`);
          this.emit('download:complete', task);
          eventBus.emit('download:complete', { trackId: task.track.id, filePath });
          this.processQueue();
        },
        accessToken: this.accessToken
      });
      task.filePath = result;
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      this.active.delete(task.id);
      this.completed.push(task);
      this.emit('download:error', task);
      eventBus.emit('download:error', { trackId: task.track.id, error });
      throw error;
    }
  }

  cancelDownload(taskId: string): boolean {
    const task = this.active.get(taskId);
    if (task) {
      task.status = 'cancelled';
      this.active.delete(taskId);
      this.emit('download:cancelled', task);
      logger.info(`❌ Cancelled: ${task.track.name}`);
      this.processQueue();
      return true;
    }
    const queueIndex = this.queue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.queue.splice(queueIndex, 1)[0];
      task.status = 'cancelled';
      this.emit('download:cancelled', task);
      return true;
    }
    return false;
  }

  getQueue(): DownloadTask[] { return [...this.queue]; }
  getActive(): DownloadTask[] { return Array.from(this.active.values()); }
  getCompleted(): DownloadTask[] { return [...this.completed]; }
  getAllTasks(): DownloadTask[] { return [...this.queue, ...this.getActive(), ...this.completed]; }
  getTask(taskId: string): DownloadTask | undefined { return this.getAllTasks().find(t => t.id === taskId); }
  clearCompleted(): void { this.completed = []; }

  getStats(): { queued: number; active: number; completed: number; failed: number } {
    return {
      queued: this.queue.length,
      active: this.active.size,
      completed: this.completed.filter(t => t.status === 'completed').length,
      failed: this.completed.filter(t => t.status === 'failed').length
    };
  }
}
