import { Logger, logger } from '../../src/core/Logger';
import winston from 'winston';

describe('Logger', () => {
  it('should return a singleton instance', () => {
    const instance1 = Logger.getInstance();
    const instance2 = Logger.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should be a winston logger', () => {
    const instance = Logger.getInstance();
    expect(instance).toBeInstanceOf(winston.Logger);
  });

  it('should have correct log levels', () => {
    expect(logger.levels).toBeDefined();
    expect(logger.levels).toHaveProperty('error');
    expect(logger.levels).toHaveProperty('warn');
    expect(logger.levels).toHaveProperty('info');
    expect(logger.levels).toHaveProperty('debug');
    expect(logger.levels).toHaveProperty('verbose');
  });

  it('should log messages without throwing', () => {
    expect(() => {
      logger.info('Test info message');
      logger.debug('Test debug message');
      logger.warn('Test warning message');
      logger.error('Test error message');
      logger.verbose('Test verbose message');
    }).not.toThrow();
  });
});
