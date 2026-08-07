import { PluginManager } from '../../src/plugins/PluginManager';

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager('./test-plugins', 5000);
  });

  it('should be instantiable', () => {
    expect(manager).toBeInstanceOf(PluginManager);
  });

  it('should have empty plugins initially', () => {
    expect(manager.getAllPlugins()).toHaveLength(0);
    expect(manager.getEnabledPlugins()).toHaveLength(0);
  });

  it('should return undefined for non-existent plugin', () => {
    expect(manager.getPlugin('non-existent')).toBeUndefined();
  });

  it('should not enable non-existent plugin', () => {
    expect(manager.enablePlugin('non-existent')).toBe(false);
  });

  it('should not disable non-existent plugin', () => {
    expect(manager.disablePlugin('non-existent')).toBe(false);
  });
});
