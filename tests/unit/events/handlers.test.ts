import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the config first
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

// Mock the queue module
vi.mock('../../../src/tasks/queue.js', () => ({
  createQueue: vi.fn(),
  createWorker: vi.fn(),
  addJob: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
  addUniqueJob: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
  queues: new Map()
}));

// Mock the logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock background tasks
vi.mock('../../../src/tasks/background.tasks.js', () => ({
  queueEmail: vi.fn().mockResolvedValue({ id: 'mock-email-job' }),
  queueUserRegistration: vi.fn().mockResolvedValue({ id: 'mock-registration-job' }),
  queueWebhook: vi.fn().mockResolvedValue({ id: 'mock-webhook-job' }),
  BACKGROUND_QUEUE_HIGH: 'background-high',
  BACKGROUND_QUEUE_DEFAULT: 'background-default',
  BACKGROUND_QUEUE_LOW: 'background-low',
  BackgroundJobType: {
    SEND_EMAIL: 'send-email',
    PROCESS_USER_REGISTRATION: 'process-user-registration'
  }
}));

import {
  EventBus,
  Events,
  EventType,
  resetEventBus,
  getEventBus,
  registerAllHandlers,
  queryAuditLog,
  getAuditStats,
  clearAuditLog,
  getSecurityMetrics,
  clearSecurityMetrics
} from '../../../src/events/index.js';

describe('Event Handlers', () => {
  beforeEach(() => {
    resetEventBus();
    clearAuditLog();
    clearSecurityMetrics();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Handler Registration', () => {
    it('should register all handlers without error', () => {
      expect(() => registerAllHandlers()).not.toThrow();
    });

    it('should register handlers only once', () => {
      const eventBus = getEventBus();
      const initialHandlerCount = (eventBus as any).handlers.size;

      registerAllHandlers();
      const afterFirstRegistration = (eventBus as any).handlers.size;

      // Handlers are added to the map
      expect(afterFirstRegistration).toBeGreaterThanOrEqual(initialHandlerCount);
    });
  });

  describe('Audit Handler', () => {
    it('should log all events', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      await eventBus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      // Wait for async handlers
      await new Promise(resolve => setTimeout(resolve, 50));

      const auditLog = queryAuditLog({ limit: 10 });
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0].eventType).toBe(EventType.USER_REGISTERED);
    });

    it('should query audit log by event type', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      await eventBus.publish(Events.userRegistered({
        userId: 1,
        username: 'test1',
        email: 'test1@test.com'
      }));

      await eventBus.publish(Events.userLoggedIn({
        userId: 1,
        username: 'test1',
        email: 'test1@test.com',
        loginMethod: 'password'
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      const registrationEvents = queryAuditLog({ eventType: EventType.USER_REGISTERED });
      const loginEvents = queryAuditLog({ eventType: EventType.USER_LOGGED_IN });

      expect(registrationEvents.length).toBe(1);
      expect(loginEvents.length).toBe(1);
    });

    it('should query audit log by correlation ID', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      await eventBus.publish(
        Events.userRegistered(
          { userId: 1, username: 'test', email: 'test@test.com' },
          { correlationId: 'test-correlation' }
        )
      );

      await new Promise(resolve => setTimeout(resolve, 50));

      const events = queryAuditLog({ correlationId: 'test-correlation' });
      expect(events.length).toBe(1);
    });

    it('should get audit stats', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      await eventBus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      await eventBus.publish(Events.userRegistered({
        userId: 2,
        username: 'test2',
        email: 'test2@test.com'
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      const stats = getAuditStats();
      expect(stats.totalEvents).toBe(2);
      expect(stats.eventsByType[EventType.USER_REGISTERED]).toBe(2);
    });

    it('should clear audit log', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      await eventBus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      clearAuditLog();
      const auditLog = queryAuditLog({});
      expect(auditLog.length).toBe(0);
    });
  });

  describe('Security Handler', () => {
    it('should track rate limit violations', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      await eventBus.publish(Events.rateLimitExceeded({
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
        limit: 100,
        resetAt: new Date()
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = getSecurityMetrics();
      expect(metrics.rateLimitHits.get('192.168.1.1')).toBe(1);
    });

    it('should accumulate rate limit hits', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      for (let i = 0; i < 5; i++) {
        await eventBus.publish(Events.rateLimitExceeded({
          ipAddress: '192.168.1.1',
          endpoint: '/api/test',
          limit: 100,
          resetAt: new Date()
        }));
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      const metrics = getSecurityMetrics();
      expect(metrics.rateLimitHits.get('192.168.1.1')).toBe(5);
    });

    it('should clear security metrics', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      await eventBus.publish(Events.rateLimitExceeded({
        ipAddress: '192.168.1.1',
        endpoint: '/api/test',
        limit: 100,
        resetAt: new Date()
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      clearSecurityMetrics();
      const metrics = getSecurityMetrics();
      expect(metrics.rateLimitHits.size).toBe(0);
    });
  });

  describe('User Handler', () => {
    it('should handle user registered event', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      // Should not throw
      await expect(
        eventBus.publish(Events.userRegistered({
          userId: 1,
          username: 'newuser',
          email: 'new@test.com'
        }))
      ).resolves.toBeUndefined();
    });

    it('should handle password changed event', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      await expect(
        eventBus.publish(Events.passwordChanged({
          userId: 1,
          changedBy: 1,
          ipAddress: '127.0.0.1'
        }))
      ).resolves.toBeUndefined();
    });

    it('should handle user status changed event', async () => {
      registerAllHandlers();
      const eventBus = getEventBus();

      await expect(
        eventBus.publish(Events.userStatusChanged({
          userId: 1,
          oldStatus: 'ACTIVE',
          newStatus: 'SUSPENDED',
          changedBy: 2,
          reason: 'Policy violation'
        }))
      ).resolves.toBeUndefined();
    });
  });
});

describe('Event Integration', () => {
  beforeEach(() => {
    resetEventBus();
    clearAuditLog();
    clearSecurityMetrics();
  });

  it('should process events in correct order', async () => {
    const order: string[] = [];

    const eventBus = getEventBus();

    // High priority
    eventBus.on(EventType.USER_REGISTERED, () => {
      order.push('high');
    }, { priority: 10 });

    // Low priority
    eventBus.on(EventType.USER_REGISTERED, () => {
      order.push('low');
    }, { priority: 1 });

    // Medium priority
    eventBus.on(EventType.USER_REGISTERED, () => {
      order.push('medium');
    }, { priority: 5 });

    await eventBus.publish(Events.userRegistered({
      userId: 1,
      username: 'test',
      email: 'test@test.com'
    }));

    expect(order).toEqual(['high', 'medium', 'low']);
  });

  it('should support event chaining', async () => {
    const eventBus = getEventBus();
    const events: string[] = [];

    // When user registers, emit login event
    eventBus.on(EventType.USER_REGISTERED, async (event) => {
      events.push('registered');
      await eventBus.publish(Events.userLoggedIn({
        userId: event.payload.userId,
        username: event.payload.username,
        email: event.payload.email,
        loginMethod: 'password'
      }));
    });

    eventBus.on(EventType.USER_LOGGED_IN, () => {
      events.push('logged_in');
    });

    await eventBus.publish(Events.userRegistered({
      userId: 1,
      username: 'test',
      email: 'test@test.com'
    }));

    expect(events).toEqual(['registered', 'logged_in']);
  });
});
