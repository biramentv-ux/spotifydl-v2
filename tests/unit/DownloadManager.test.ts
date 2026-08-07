import { DownloadManager } from '../../src/download/DownloadManager';
import { HybridEngine } from '../../src/download/engines/HybridEngine';
import { ConfigManager } from '../../src/core/ConfigManager';

jest.mock('../../src/core/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn()
  }
}));

jest.mock('../../src/core/EventBus', () => ({
  eventBus: {
    emit: jest.fn()
  }
}));

describe('DownloadManager', () => {
  let downloadManager: DownloadManager;
  let mockConfig: ConfigManager;
  let mockEngine: HybridEngine;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn().mockReturnValue({
        concurrency: 3,
        outputDir: './downloads',
        format: 'mp3',
        quality: 'high'
      })
    } as any;

    mockEngine = {
      download: jest.fn().mockResolvedValue('/downloads/test.mp3')
    } as any;

    downloadManager = new DownloadManager(mockConfig, mockEngine);
  });

  describe('addToQueue', () => {
    it('should add a track to the queue', () => {
      const track = {
        id: 'track123',
        name: 'Test Track',
        artists: [{ id: 'artist1', name: 'Test Artist' }],
        album: { id: 'album1', name: 'Test Album', images: [], release_date: '2024-01-01' },
        duration_ms: 180000,
        explicit: false,
        popularity: 80,
        preview_url: null,
        track_number: 1
      };

      const taskId = downloadManager.addToQueue(track);
      expect(taskId).toBeDefined();
      expect(downloadManager.getQueue()).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('should return correct initial stats', () => {
      const stats = downloadManager.getStats();
      expect(stats.queued).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('cancelDownload', () => {
    it('should return false for non-existent task', () => {
      const result = downloadManager.cancelDownload('non-existent');
      expect(result).toBe(false);
    });
  });
});
