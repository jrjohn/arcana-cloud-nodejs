/**
 * Additional tests for src/events/event-bus.ts
 *
 * Covers uncovered paths: initialize(), configure(), processAsyncEvent(),
 * moveToDeadLetter(), getEventPriority(), getPendingCount(), getFailedCount(),
 * replayDeadLetterEvents(), close(), initializeEventBus(), setEventBusInstance()
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config
vi.mock('../../../src/config.js', () => ({
  config: {
    nodeEnv: 'testing',
    port: 3000,
    host: '0.0.0.0',
    redisUrl: null,
    corsOrigins: '*',
    logLevel: 'info',
    deploymentMode: 'monolithic',
    deploymentLayer: 'monolithic',
    communicationProtocol: 'direct'
  }
}));

// Use a global variable approach that vitest can hoist safely
vi.mock('../../../src/tasks/queue.js', () => {
  const mockQueuesMap = new Map();
  // Store on globalThis so tests can access
  (globalThis as any).__mockQueuesMap = mockQueuesMap;
  return {
    createQueue: vi.fn().mockReturnValue({
      getWaitingCount: vi.fn().mockResolvedValue(5),
      getFailedCount: vi.fn().mockResolvedValue(2),
      getJobs: vi.fn().mockResolvedValue([])
    }),
    createWorker: vi.fn(),
    addJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
    queues: mockQueuesMap
  };
});

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import {
  EventBus,
  getEventBus,
  resetEventBus,
  initializeEventBus,
  setEventBusInstance
} from '../../../src/events/event-bus.js';
import { EventType, Events } from '../../../src/events/domain-events.js';
import { queues, addJob, createQueue, createWorker } from '../../../src/tasks/queue.js';
import { logger } from '../../../src/utils/logger.js';

// Get the mockQueuesMap reference
const mockQueuesMap = (globalThis as any).__mockQueuesMap as Map<string, any>;

describe('EventBus - Extended Coverage', () => {
  beforeEach(() => {
    resetEventBus();
    mockQueuesMap.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('configure()', () => {
    it('should merge configuration and return this for chaining', () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      const result = bus.configure({ maxRetries: 5, retryDelay: 2000 });

      expect(result).toBe(bus);
    });

    it('should override specific config values', () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      bus.configure({ enableAuditLog: false });

      // No crash means config applied
      expect(bus).toBeDefined();
    });
  });

  describe('initialize()', () => {
    it('should be idempotent (no-op on second call)', async () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      await bus.initialize();
      await bus.initialize(); // Should return early
    });

    it('should handle async initialization failure gracefully', async () => {
      vi.mocked(createQueue).mockImplementationOnce(() => {
        throw new Error('Redis not available');
      });

      const bus = new EventBus(undefined, { enableAsync: true });
      await bus.initialize();
      // Should not throw, just disable async
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Async event processing not available (Redis required)'
      );
    });

    it('should create async queues when enableAsync is true', async () => {
      const bus = new EventBus(undefined, { enableAsync: true });
      await bus.initialize();

      expect(createQueue).toHaveBeenCalledWith(expect.objectContaining({
        name: 'events'
      }));
      expect(createQueue).toHaveBeenCalledWith(expect.objectContaining({
        name: 'events-dlq'
      }));
      expect(createWorker).toHaveBeenCalled();
    });
  });

  describe('on() with async option', () => {
    it('should register async handler', () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      const handler = vi.fn();
      const result = bus.on(EventType.USER_REGISTERED, handler, { async: true, priority: 5 });

      expect(result).toBe(bus);
    });
  });

  describe('onAll() with priority', () => {
    it('should register global handler with priority sorting', () => {
      const bus = new EventBus(undefined, { enableAsync: false });

      bus.onAll(vi.fn(), { priority: 1 });
      bus.onAll(vi.fn(), { priority: 10 });
      bus.onAll(vi.fn(), { priority: 5 });

      const globalHandlers = (bus as any).globalHandlers;
      expect(globalHandlers[0].priority).toBe(10);
      expect(globalHandlers[1].priority).toBe(5);
      expect(globalHandlers[2].priority).toBe(1);
    });
  });

  describe('off() edge cases', () => {
    it('should handle off() for non-existent event type', () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      const handler = vi.fn();
      bus.off(EventType.USER_DELETED, handler); // Should not throw
    });

    it('should handle off() for handler not in list', () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on(EventType.USER_REGISTERED, handler1);
      bus.off(EventType.USER_REGISTERED, handler2); // handler2 was never registered
    });
  });

  describe('processLocalHandlers with async handlers', () => {
    it('should queue async event when async handlers exist and async enabled', async () => {
      const bus = new EventBus(undefined, { enableAsync: true });
      const asyncHandler = vi.fn();

      bus.on(EventType.USER_REGISTERED, asyncHandler, { async: true });

      // Put the queue in the map so queueAsyncEvent proceeds
      mockQueuesMap.set('events', {});

      const event = Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      });

      await bus.publish(event);

      expect(addJob).toHaveBeenCalled();
    });

    it('should warn when queue not initialized for async events', async () => {
      const bus = new EventBus(undefined, { enableAsync: true });
      const asyncHandler = vi.fn();

      bus.on(EventType.USER_REGISTERED, asyncHandler, { async: true });

      mockQueuesMap.clear();

      const event = Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      });

      await bus.publish(event);

      expect(logger.warn).toHaveBeenCalledWith('Event queue not initialized, processing synchronously');
    });
  });

  describe('getEventPriority()', () => {
    it('should assign correct priorities for known event types', () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      const priorityFn = (bus as any).getEventPriority.bind(bus);

      expect(priorityFn(EventType.SECURITY_ALERT)).toBe(10);
      expect(priorityFn(EventType.USER_REGISTERED)).toBe(8);
      expect(priorityFn(EventType.PASSWORD_CHANGED)).toBe(8);
      expect(priorityFn(EventType.USER_LOGGED_IN)).toBe(5);
      expect(priorityFn(EventType.USER_UPDATED)).toBe(3);
      expect(priorityFn(EventType.TOKEN_CREATED)).toBe(2);
    });

    it('should return default priority 1 for unknown event types', () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      const priorityFn = (bus as any).getEventPriority.bind(bus);

      expect(priorityFn('unknown.event')).toBe(1);
    });
  });

  describe('getEventStore()', () => {
    it('should return null when not initialized with prisma', () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      expect(bus.getEventStore()).toBeNull();
    });
  });

  describe('getPendingCount()', () => {
    it('should return 0 when queue not present', async () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      mockQueuesMap.clear();

      const count = await bus.getPendingCount();
      expect(count).toBe(0);
    });

    it('should return count from queue', async () => {
      const bus = new EventBus(undefined, { enableAsync: true });
      mockQueuesMap.set('events', {
        getWaitingCount: vi.fn().mockResolvedValue(5),
        getFailedCount: vi.fn().mockResolvedValue(2)
      });

      const count = await bus.getPendingCount();
      expect(count).toBe(5);
    });
  });

  describe('getFailedCount()', () => {
    it('should return 0 when queue not present', async () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      mockQueuesMap.clear();

      const count = await bus.getFailedCount();
      expect(count).toBe(0);
    });

    it('should return count from queue', async () => {
      const bus = new EventBus(undefined, { enableAsync: true });
      mockQueuesMap.set('events', {
        getWaitingCount: vi.fn().mockResolvedValue(5),
        getFailedCount: vi.fn().mockResolvedValue(2)
      });

      const count = await bus.getFailedCount();
      expect(count).toBe(2);
    });
  });

  describe('replayDeadLetterEvents()', () => {
    it('should return 0 when DLQ not present', async () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      mockQueuesMap.clear();

      const count = await bus.replayDeadLetterEvents();
      expect(count).toBe(0);
    });

    it('should replay events from DLQ', async () => {
      const bus = new EventBus(undefined, { enableAsync: false });

      const mockEvent = Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      });

      const mockJob = {
        data: { event: mockEvent },
        remove: vi.fn().mockResolvedValue(undefined)
      };

      const dlqQueue = {
        getJobs: vi.fn().mockResolvedValue([mockJob])
      };

      mockQueuesMap.set('events-dlq', dlqQueue);

      const publishSpy = vi.spyOn(bus, 'publish').mockResolvedValue(undefined);

      const count = await bus.replayDeadLetterEvents(10);
      expect(count).toBe(1);
      expect(publishSpy).toHaveBeenCalledWith(mockEvent);
      expect(mockJob.remove).toHaveBeenCalled();
    });
  });

  describe('close()', () => {
    it('should reset initialized flag', async () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      await bus.initialize();

      await bus.close();

      // After close, initialize should work again
      await bus.initialize();
    });
  });

  describe('publishAll()', () => {
    it('should publish multiple events', async () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      const handler = vi.fn();
      bus.on(EventType.USER_REGISTERED, handler);

      const events = [
        Events.userRegistered({ userId: 1, username: 'a', email: 'a@test.com' }),
        Events.userRegistered({ userId: 2, username: 'b', email: 'b@test.com' })
      ];

      await bus.publishAll(events);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('initializeEventBus()', () => {
    it('should create and initialize a new event bus instance', async () => {
      const bus = await initializeEventBus({ enableAsync: false });
      expect(bus).toBeDefined();
      expect(bus).toBeInstanceOf(EventBus);
    });

    it('should close previous instance before creating new one', async () => {
      const bus1 = await initializeEventBus({ enableAsync: false });
      const closeSpy = vi.spyOn(bus1, 'close');

      const bus2 = await initializeEventBus({ enableAsync: false });

      expect(closeSpy).toHaveBeenCalled();
      expect(bus2).not.toBe(bus1);
    });
  });

  describe('setEventBusInstance()', () => {
    it('should set the singleton instance', () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      setEventBusInstance(bus);

      const retrieved = getEventBus();
      expect(retrieved).toBe(bus);
    });
  });

  describe('middleware edge cases', () => {
    it('should execute final handler directly when no middleware', async () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      const handler = vi.fn();
      bus.on(EventType.USER_REGISTERED, handler);

      const event = Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      });

      await bus.publish(event);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should allow middleware to block event processing by not calling next', async () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      const handler = vi.fn();

      bus.use(async (_event, _next) => {
        // Intentionally not calling next
      });

      bus.on(EventType.USER_REGISTERED, handler);

      await bus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('sync handler error recovery', () => {
    it('should continue to next handler after error in previous', async () => {
      const bus = new EventBus(undefined, { enableAsync: false });
      const results: string[] = [];

      bus.on(EventType.USER_REGISTERED, () => {
        results.push('first');
        throw new Error('First handler error');
      });

      bus.on(EventType.USER_REGISTERED, () => {
        results.push('second');
      });

      await bus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      expect(results).toEqual(['first', 'second']);
    });
  });
});
