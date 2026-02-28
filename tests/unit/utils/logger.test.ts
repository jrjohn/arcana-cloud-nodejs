import { describe, it, expect } from 'vitest';

describe('Logger', () => {
  it('should export a logger instance', async () => {
    // Mock pino-pretty to avoid transport errors in test environment
    process.env.NODE_ENV = 'testing';
    const { logger, createChildLogger } = await import('../../../src/utils/logger.js');

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should create child logger', async () => {
    const { logger, createChildLogger } = await import('../../../src/utils/logger.js');

    const childLogger = createChildLogger({ service: 'test', requestId: '123' });

    expect(childLogger).toBeDefined();
    expect(typeof childLogger.info).toBe('function');
  });

  it('should be callable without throwing', async () => {
    const { logger } = await import('../../../src/utils/logger.js');

    expect(() => logger.info('test info message')).not.toThrow();
    expect(() => logger.warn('test warn message')).not.toThrow();
    expect(() => logger.error('test error message')).not.toThrow();
    expect(() => logger.debug('test debug message')).not.toThrow();
  });
});
