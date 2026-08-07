import { HybridEngine } from '../../src/download/engines/HybridEngine';

describe('HybridEngine', () => {
  let engine: HybridEngine;

  beforeEach(() => {
    engine = new HybridEngine();
  });

  it('should initialize with zero stats', () => {
    const stats = engine.getStats();
    expect(stats.playplaySuccess).toBe(0);
    expect(stats.playplayFailures).toBe(0);
    expect(stats.widevineSuccess).toBe(0);
    expect(stats.widevineFailures).toBe(0);
  });

  it('should reset stats', () => {
    engine.resetStats();
    const stats = engine.getStats();
    expect(stats.playplaySuccess).toBe(0);
    expect(stats.widevineSuccess).toBe(0);
  });

  it('should prefer playplay as default engine', () => {
    expect(engine.getPreferredEngine()).toBe('playplay');
  });
});
