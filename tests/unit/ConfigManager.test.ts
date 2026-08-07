import { ConfigManager } from '../../src/core/ConfigManager';

describe('ConfigManager', () => {
  let config: ConfigManager;

  beforeEach(() => {
    config = new ConfigManager();
  });

  it('should have default values', () => {
    const spotify = config.get('spotify');
    expect(spotify).toBeDefined();
    expect(spotify.clientId).toBe('');
    expect(spotify.scopes).toContain('user-read-private');
  });

  it('should get all config', () => {
    const all = config.getAll();
    expect(all).toHaveProperty('spotify');
    expect(all).toHaveProperty('download');
    expect(all).toHaveProperty('server');
    expect(all).toHaveProperty('visualizer');
    expect(all).toHaveProperty('plugins');
  });

  it('should set values', () => {
    config.set('download', { ...config.get('download'), concurrency: 5 });
    expect(config.get('download').concurrency).toBe(5);
  });

  it('should have correct download defaults', () => {
    const download = config.get('download');
    expect(download.concurrency).toBe(3);
    expect(download.format).toBe('mp3');
    expect(download.quality).toBe('high');
  });

  it('should have correct server defaults', () => {
    const server = config.get('server');
    expect(server.port).toBe(3000);
    expect(server.host).toBe('0.0.0.0');
  });
});
