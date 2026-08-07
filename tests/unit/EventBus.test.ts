import { EventBus } from '../../src/core/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('should emit and receive events', () => {
    const listener = jest.fn();
    eventBus.on('download:progress', listener);

    const data = { trackId: '123', progress: 50, speed: 1000, status: 'downloading' as const };
    eventBus.emit('download:progress', data);

    expect(listener).toHaveBeenCalledWith(data);
  });

  it('should support multiple listeners', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();

    eventBus.on('xp:gain', listener1);
    eventBus.on('xp:gain', listener2);

    const data = { userId: 'user1', points: 100, level: 5, leveledUp: false };
    eventBus.emit('xp:gain', data);

    expect(listener1).toHaveBeenCalledWith(data);
    expect(listener2).toHaveBeenCalledWith(data);
  });

  it('should remove listeners', () => {
    const listener = jest.fn();
    eventBus.on('download:complete', listener);
    eventBus.off('download:complete', listener);

    eventBus.emit('download:complete', { trackId: '123', filePath: '/test.mp3' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should support once listeners', () => {
    const listener = jest.fn();
    eventBus.once('download:progress', listener);

    const data = { trackId: '123', progress: 50, speed: 1000, status: 'downloading' as const };
    eventBus.emit('download:progress', data);
    eventBus.emit('download:progress', data);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
