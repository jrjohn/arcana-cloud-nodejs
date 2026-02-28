import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/config.js', () => ({
  config: {
    redisUrl: null,
    nodeEnv: 'testing'
  }
}));

vi.mock('../../../src/tasks/queue.js', () => ({
  createQueue: vi.fn(),
  createWorker: vi.fn(),
  addJob: vi.fn().mockResolvedValue({ id: 'job-1' }),
  queues: new Map()
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/tasks/background.tasks.js', () => ({
  queueEmail: vi.fn().mockResolvedValue({ id: 'email-job' }),
  queueUserRegistration: vi.fn().mockResolvedValue({ id: 'reg-job' }),
  queueWebhook: vi.fn().mockResolvedValue({ id: 'webhook-job' }),
  BACKGROUND_QUEUE_HIGH: 'background-high',
  BACKGROUND_QUEUE_DEFAULT: 'background-default',
  BACKGROUND_QUEUE_LOW: 'background-low'
}));

import {
  initializeEventSystem,
  getEventBus,
  resetEventBus,
  EventBus,
  EventType,
  Events,
  createEvent,
  setEventBusInstance
} from '../../../src/events/index.js';
import { logger } from '../../../src/utils/logger.js';

describe('Events Index', () => {
  beforeEach(() => {
    resetEventBus();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEventBus();
  });

  describe('initializeEventSystem', () => {
    it('should initialize event system without Redis', async () => {
      await expect(initializeEventSystem({
        enableAsync: false,
        enableIdempotency: false,
        enablePubSub: false,
        enableAuditLog: false,
        asyncQueueName: 'test-events',
        deadLetterQueueName: 'test-events-dlq',
        maxRetries: 3,
        retryDelay: 1000
      })).resolves.not.toThrow();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Event system initialized'),
        expect.any(Object)
      );
    });

    it('should log initialization details', async () => {
      await initializeEventSystem({
        enableIdempotency: true,
        enablePubSub: false,
        enableAuditLog: true
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Event system initialized',
        expect.objectContaining({
          idempotency: true,
          auditLog: true
        })
      );
    });

    it('should initialize with default config', async () => {
      await expect(initializeEventSystem()).resolves.not.toThrow();
    });
  });

  describe('setEventBusInstance', () => {
    it('should set custom event bus instance', () => {
      const customBus = new EventBus();
      setEventBusInstance(customBus);

      const retrieved = getEventBus();
      expect(retrieved).toBe(customBus);
    });
  });

  describe('re-exports from events/index.ts', () => {
    it('should export EventBus', () => {
      expect(EventBus).toBeDefined();
    });

    it('should export EventType', () => {
      expect(EventType).toBeDefined();
      expect(EventType.USER_REGISTERED).toBeDefined();
    });

    it('should export Events factory', () => {
      expect(Events).toBeDefined();
      expect(typeof Events.userRegistered).toBe('function');
    });

    it('should export createEvent', () => {
      expect(typeof createEvent).toBe('function');
    });
  });
});
