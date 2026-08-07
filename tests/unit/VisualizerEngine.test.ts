import { VisualizerEngine } from '../../src/visualizer/VisualizerEngine';

describe('VisualizerEngine', () => {
  let engine: VisualizerEngine;

  beforeEach(() => {
    engine = new VisualizerEngine();
  });

  it('should be instantiable', () => {
    expect(engine).toBeInstanceOf(VisualizerEngine);
  });

  it('should return available modes', () => {
    const modes = engine.getAvailableModes();
    expect(modes).toContain('waveform');
    expect(modes).toContain('spectrum');
    expect(modes).toContain('particle');
    expect(modes).toContain('ascii');
  });

  it('should have 4 visualization modes', () => {
    expect(engine.getAvailableModes()).toHaveLength(4);
  });
});
