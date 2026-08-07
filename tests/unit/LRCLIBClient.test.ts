import { LRCLIBClient } from '../../src/metadata/LRCLIBClient';

describe('LRCLIBClient', () => {
  let client: LRCLIBClient;

  beforeEach(() => {
    client = new LRCLIBClient();
  });

  it('should parse synced lyrics', () => {
    const lyrics = '[00:12.34]First line\n[00:15.67]Second line';
    const parsed = client.parseSyncedLyrics(lyrics);
    
    expect(parsed.length).toBe(2);
    expect(parsed[0].time).toBe(12340);
    expect(parsed[0].text).toBe('First line');
    expect(parsed[1].time).toBe(15670);
  });

  it('should format synced lyrics', () => {
    const lines = [
      { time: 12340, text: 'First line' },
      { time: 15670, text: 'Second line' }
    ];
    const formatted = client.formatSyncedLyrics(lines);
    
    expect(formatted).toContain('[00:12.34]First line');
    expect(formatted).toContain('[00:15.67]Second line');
  });

  it('should handle empty lyrics', () => {
    const parsed = client.parseSyncedLyrics('');
    expect(parsed).toEqual([]);
  });
});
