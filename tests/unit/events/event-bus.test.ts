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
  addJob: vi.fn(),
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

import {
  EventBus,
  DomainEvent,
  EventType,
  Events,
  createEvent,
  resetEventBus,
  getEventBus
} from '../../../src/events/index.js';

describe('Event Bus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    resetEventBus();
    eventBus = new EventBus({ enableAsync: false }); // Disable async for unit tests
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Creation', () => {
    it('should create event with correct structure', () => {
      const event = Events.userRegistered({
        userId: 1,
        username: 'testuser',
        email: 'test@example.com'
      });

      expect(event.type).toBe(EventType.USER_REGISTERED);
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.payload.userId).toBe(1);
      expect(event.payload.username).toBe('testuser');
      expect(event.payload.email).toBe('test@example.com');
    });

    it('should create event with metadata', () => {
      const event = Events.userLoggedIn(
        {
          userId: 1,
          username: 'testuser',
          email: 'test@example.com',
          loginMethod: 'password'
        },
        { correlationId: 'test-correlation-id' }
      );

      expect(event.correlationId).toBe('test-correlation-id');
    });

    it('should create all event types', () => {
      const events = [
        Events.userRegistered({ userId: 1, username: 'test', email: 'test@test.com' }),
        Events.userLoggedIn({ userId: 1, username: 'test', email: 'test@test.com', loginMethod: 'password' }),
        Events.userLoggedOut({ userId: 1, logoutType: 'single' }),
        Events.passwordChanged({ userId: 1, changedBy: 1 }),
        Events.userStatusChanged({ userId: 1, oldStatus: 'ACTIVE', newStatus: 'SUSPENDED', changedBy: 2 }),
        Events.tokenRevoked({ tokenId: 1, userId: 1, revokedBy: 1 }),
        Events.allTokensRevoked({ userId: 1, revokedBy: 1, tokenCount: 5 }),
        Events.rateLimitExceeded({ ipAddress: '127.0.0.1', endpoint: '/api/test', limit: 100, resetAt: new Date() }),
        Events.securityAlert({ type: 'brute_force', ipAddress: '127.0.0.1', details: 'test', severity: 'high' })
      ];

      events.forEach(event => {
        expect(event.type).toBeDefined();
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(event.payload).toBeDefined();
      });
    });
  });

  describe('Event Subscription', () => {
    it('should register sync handler', async () => {
      const handler = vi.fn();
      eventBus.on(EventType.USER_REGISTERED, handler);

      const event = Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      });

      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should handle multiple handlers for same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on(EventType.USER_REGISTERED, handler1);
      eventBus.on(EventType.USER_REGISTERED, handler2);

      const event = Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      });

      await eventBus.publish(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should call handlers in priority order', async () => {
      const callOrder: number[] = [];

      eventBus.on(EventType.USER_REGISTERED, () => { callOrder.push(1); }, { priority: 1 });
      eventBus.on(EventType.USER_REGISTERED, () => { callOrder.push(2); }, { priority: 10 });
      eventBus.on(EventType.USER_REGISTERED, () => { callOrder.push(3); }, { priority: 5 });

      await eventBus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      expect(callOrder).toEqual([2, 3, 1]); // Higher priority first
    });

    it('should handle global handlers', async () => {
      const globalHandler = vi.fn();
      eventBus.onAll(globalHandler);

      await eventBus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      await eventBus.publish(Events.userLoggedIn({
        userId: 1,
        username: 'test',
        email: 'test@test.com',
        loginMethod: 'password'
      }));

      expect(globalHandler).toHaveBeenCalledTimes(2);
    });

    it('should unsubscribe handler', async () => {
      const handler = vi.fn();
      eventBus.on(EventType.USER_REGISTERED, handler);
      eventBus.off(EventType.USER_REGISTERED, handler);

      await eventBus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Event Publishing', () => {
    it('should publish event to subscribers', async () => {
      const handler = vi.fn();
      eventBus.on(EventType.PASSWORD_CHANGED, handler);

      const event = Events.passwordChanged({
        userId: 1,
        changedBy: 1
      });

      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should publish multiple events', async () => {
      const handler = vi.fn();
      eventBus.on(EventType.USER_REGISTERED, handler);

      const events = [
        Events.userRegistered({ userId: 1, username: 'test1', email: 'test1@test.com' }),
        Events.userRegistered({ userId: 2, username: 'test2', email: 'test2@test.com' }),
        Events.userRegistered({ userId: 3, username: 'test3', email: 'test3@test.com' })
      ];

      await eventBus.publishAll(events);

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should continue processing if handler throws', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const successHandler = vi.fn();

      eventBus.on(EventType.USER_REGISTERED, errorHandler);
      eventBus.on(EventType.USER_REGISTERED, successHandler);

      await eventBus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('Event Middleware', () => {
    it('should execute middleware', async () => {
      const middlewareCall = vi.fn();

      eventBus.use(async (event, next) => {
        middlewareCall('before');
        await next();
        middlewareCall('after');
      });

      const handler = vi.fn();
      eventBus.on(EventType.USER_REGISTERED, handler);

      await eventBus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      expect(middlewareCall).toHaveBeenCalledWith('before');
      expect(middlewareCall).toHaveBeenCalledWith('after');
      expect(handler).toHaveBeenCalled();
    });

    it('should chain multiple middleware', async () => {
      const order: string[] = [];

      eventBus.use(async (_, next) => {
        order.push('m1-before');
        await next();
        order.push('m1-after');
      });

      eventBus.use(async (_, next) => {
        order.push('m2-before');
        await next();
        order.push('m2-after');
      });

      eventBus.on(EventType.USER_REGISTERED, () => {
        order.push('handler');
      });

      await eventBus.publish(Events.userRegistered({
        userId: 1,
        username: 'test',
        email: 'test@test.com'
      }));

      expect(order).toEqual([
        'm1-before',
        'm2-before',
        'handler',
        'm2-after',
        'm1-after'
      ]);
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      resetEventBus();
      const bus1 = getEventBus();
      const bus2 = getEventBus();

      expect(bus1).toBe(bus2);
    });

    it('should reset instance', () => {
      const bus1 = getEventBus();
      resetEventBus();
      const bus2 = getEventBus();

      expect(bus1).not.toBe(bus2);
    });
  });
});

describe('Domain Events', () => {
  it('should have correct event types', () => {
    expect(EventType.USER_REGISTERED).toBe('user.registered');
    expect(EventType.USER_LOGGED_IN).toBe('user.logged_in');
    expect(EventType.USER_LOGGED_OUT).toBe('user.logged_out');
    expect(EventType.PASSWORD_CHANGED).toBe('user.password_changed');
    expect(EventType.TOKEN_CREATED).toBe('token.created');
    expect(EventType.TOKEN_REVOKED).toBe('token.revoked');
    expect(EventType.SECURITY_ALERT).toBe('security.alert');
  });

  it('should create event with factory function', () => {
    const event = createEvent(EventType.USER_REGISTERED, {
      userId: 1,
      username: 'test',
      email: 'test@test.com'
    });

    expect(event.type).toBe(EventType.USER_REGISTERED);
    expect(event.payload.userId).toBe(1);
  });
});
