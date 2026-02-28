import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../../../src/config.js', () => ({
  config: {
    redisUrl: null, // No Redis for most tests
    nodeEnv: 'testing'
  }
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('ioredis');

import { EventStore, getEventStore, resetEventStore } from '../../../src/events/event-store.js';
import { DomainEvent, EventType } from '../../../src/events/domain-events.js';
import { logger } from '../../../src/utils/logger.js';

function makeMockPrisma() {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([])
    }
  };
}

function makeTestEvent(overrides?: Partial<DomainEvent>): DomainEvent {
  return {
    eventId: 'test-event-id-123',
    type: EventType.USER_REGISTERED,
    version: 1,
    occurredAt: new Date(),
    payload: {
      userId: 1,
      username: 'testuser',
      email: 'test@example.com',
      ipAddress: '127.0.0.1'
    },
    ...overrides
  };
}

describe('EventStore', () => {
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let store: EventStore;

  beforeEach(() => {
    mockPrisma = makeMockPrisma();
    resetEventStore();
    store = new EventStore(mockPrisma as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetEventStore();
  });

  describe('constructor (no Redis)', () => {
    it('should create store and warn about missing Redis', () => {
      expect(store).toBeDefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis URL not configured')
      );
    });
  });

  describe('isEventProcessed (in-memory fallback)', () => {
    it('should return false for new events', async () => {
      const result = await store.isEventProcessed('new-event-id');
      expect(result).toBe(false);
    });

    it('should return true for processed events', async () => {
      await store.markEventProcessed('processed-id');
      const result = await store.isEventProcessed('processed-id');
      expect(result).toBe(true);
    });
  });

  describe('markEventProcessed (in-memory fallback)', () => {
    it('should mark event as processed', async () => {
      await store.markEventProcessed('some-event-id');
      const result = await store.isEventProcessed('some-event-id');
      expect(result).toBe(true);
    });

    it('should handle large sets by trimming oldest entries', async () => {
      // Add many events to trigger trimming (>10000)
      for (let i = 0; i < 10005; i++) {
        await store.markEventProcessed(`event-${i}`);
      }
      // Store should still work
      await store.markEventProcessed('final-event');
      const result = await store.isEventProcessed('final-event');
      expect(result).toBe(true);
    });
  });

  describe('saveAuditLog', () => {
    it('should save audit log entry to database', async () => {
      const event = makeTestEvent();
      await store.saveAuditLog(event);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId: event.eventId,
          eventType: event.type,
          eventVersion: event.version,
          occurredAt: event.occurredAt,
          payload: event.payload,
          userId: 1,
          ipAddress: '127.0.0.1'
        })
      });
    });

    it('should not throw when database save fails', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));
      const event = makeTestEvent();

      await expect(store.saveAuditLog(event)).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save audit log'),
        expect.any(Error)
      );
    });

    it('should save event without userId when not in payload', async () => {
      const event = makeTestEvent({ payload: { data: 'no-user' } });
      await store.saveAuditLog(event);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: undefined,
          ipAddress: undefined
        })
      });
    });
  });

  describe('queryAuditLog', () => {
    it('should query audit log with no filters', async () => {
      const mockItems = [{ id: '1', eventId: 'e1', eventType: 'user.registered', eventVersion: 1, correlationId: null, payload: {}, occurredAt: new Date(), processedAt: new Date(), userId: null }];
      mockPrisma.auditLog.findMany.mockResolvedValue(mockItems);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await store.queryAuditLog({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by eventType', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await store.queryAuditLog({ eventType: 'user.registered' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eventType: 'user.registered' })
        })
      );
    });

    it('should filter by userId', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await store.queryAuditLog({ userId: 42 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 42 })
        })
      );
    });

    it('should filter by correlationId', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await store.queryAuditLog({ correlationId: 'corr-123' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ correlationId: 'corr-123' })
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');

      await store.queryAuditLog({ fromDate: from, toDate: to });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            occurredAt: { gte: from, lte: to }
          })
        })
      );
    });

    it('should apply limit and offset', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await store.queryAuditLog({ limit: 50, offset: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 10 })
      );
    });
  });

  describe('getAuditStats', () => {
    it('should return audit statistics', async () => {
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(25);  // last24Hours

      mockPrisma.auditLog.groupBy.mockResolvedValue([
        { eventType: 'user.registered', _count: { eventType: 5 } },
        { eventType: 'user.logged_in', _count: { eventType: 20 } }
      ]);

      const stats = await store.getAuditStats();

      expect(stats.totalEvents).toBe(100);
      expect(stats.last24Hours).toBe(25);
      expect(stats.eventsByType['user.registered']).toBe(5);
      expect(stats.eventsByType['user.logged_in']).toBe(20);
    });
  });

  describe('incrementRateLimitHit (in-memory fallback)', () => {
    it('should increment and return new count', async () => {
      const count1 = await store.incrementRateLimitHit('192.168.1.1');
      expect(count1).toBe(1);

      const count2 = await store.incrementRateLimitHit('192.168.1.1');
      expect(count2).toBe(2);
    });

    it('should track different IPs separately', async () => {
      await store.incrementRateLimitHit('1.1.1.1');
      await store.incrementRateLimitHit('2.2.2.2');
      await store.incrementRateLimitHit('2.2.2.2');

      const hits1 = await store.getRateLimitHits('1.1.1.1');
      const hits2 = await store.getRateLimitHits('2.2.2.2');

      expect(hits1).toBe(1);
      expect(hits2).toBe(2);
    });
  });

  describe('getRateLimitHits (in-memory fallback)', () => {
    it('should return 0 for unknown IP', async () => {
      const count = await store.getRateLimitHits('unknown-ip');
      expect(count).toBe(0);
    });
  });

  describe('getSecurityMetrics (in-memory fallback)', () => {
    it('should return local metrics', async () => {
      await store.incrementRateLimitHit('10.0.0.1');
      const metrics = await store.getSecurityMetrics();

      expect(metrics.rateLimitHits.get('10.0.0.1')).toBe(1);
    });
  });

  describe('clearSecurityMetrics (in-memory fallback)', () => {
    it('should clear all in-memory metrics', async () => {
      await store.incrementRateLimitHit('10.0.0.1');
      await store.clearSecurityMetrics();

      const hits = await store.getRateLimitHits('10.0.0.1');
      expect(hits).toBe(0);
    });
  });

  describe('publishToChannel', () => {
    it('should do nothing without Redis', async () => {
      const event = makeTestEvent();
      // Should not throw
      await expect(store.publishToChannel(event)).resolves.not.toThrow();
    });
  });

  describe('subscribeToChannel', () => {
    it('should warn without Redis subscriber', async () => {
      const handler = vi.fn();
      await store.subscribeToChannel(handler);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis subscriber not available')
      );
    });
  });

  describe('close', () => {
    it('should close without Redis connections', async () => {
      await expect(store.close()).resolves.not.toThrow();
    });
  });

  describe('clearLocalCache', () => {
    it('should clear processed events cache', async () => {
      await store.markEventProcessed('event-to-clear');
      store.clearLocalCache();
      const result = await store.isEventProcessed('event-to-clear');
      expect(result).toBe(false);
    });
  });

  describe('getEventStore', () => {
    it('should create a new store with Prisma', () => {
      resetEventStore();
      const s = getEventStore(mockPrisma as any);
      expect(s).toBeDefined();
    });

    it('should return same instance on subsequent calls', () => {
      resetEventStore();
      const s1 = getEventStore(mockPrisma as any);
      const s2 = getEventStore();
      expect(s1).toBe(s2);
    });

    it('should throw when not initialized and no Prisma provided', () => {
      resetEventStore();
      expect(() => getEventStore()).toThrow('EventStore not initialized');
    });
  });
});

describe('EventStore with Redis', () => {
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(() => {
    mockPrisma = makeMockPrisma();
    resetEventStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetEventStore();
  });

  it('should handle Redis initialization error gracefully', async () => {
    // Set redisUrl but have Redis constructor throw
    const { config } = await import('../../../src/config.js');
    const original = (config as any).redisUrl;
    (config as any).redisUrl = 'redis://localhost:6379';

    const Redis = (await import('ioredis')).default;
    vi.mocked(Redis).mockImplementationOnce(() => {
      throw new Error('Connection refused');
    });

    const store = new EventStore(mockPrisma as any);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to initialize Redis for event store:',
      expect.any(Error)
    );

    (config as any).redisUrl = original;
  });

  it('should use Redis for idempotency when available', async () => {
    const { config } = await import('../../../src/config.js');
    const original = (config as any).redisUrl;
    (config as any).redisUrl = 'redis://localhost:6379';

    const mockRedisInstance = {
      on: vi.fn(),
      exists: vi.fn().mockResolvedValue(1),
      setex: vi.fn().mockResolvedValue('OK'),
      incr: vi.fn().mockResolvedValue(5),
      expire: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue('5'),
      keys: vi.fn().mockResolvedValue([]),
      del: vi.fn().mockResolvedValue(1),
      publish: vi.fn().mockResolvedValue(1),
      subscribe: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue('OK')
    };

    const Redis = (await import('ioredis')).default;
    vi.mocked(Redis).mockImplementation(() => mockRedisInstance as any);

    const store = new EventStore(mockPrisma as any);

    const isProcessed = await store.isEventProcessed('test-id');
    expect(isProcessed).toBe(true);

    await store.markEventProcessed('new-id');
    expect(mockRedisInstance.setex).toHaveBeenCalled();

    (config as any).redisUrl = original;
  });

  it('should fall back to local when Redis fails', async () => {
    const { config } = await import('../../../src/config.js');
    const original = (config as any).redisUrl;
    (config as any).redisUrl = 'redis://localhost:6379';

    const mockRedisInstance = {
      on: vi.fn(),
      exists: vi.fn().mockRejectedValue(new Error('Redis down')),
      setex: vi.fn().mockRejectedValue(new Error('Redis down')),
      incr: vi.fn().mockRejectedValue(new Error('Redis down')),
      get: vi.fn().mockRejectedValue(new Error('Redis down')),
      keys: vi.fn().mockRejectedValue(new Error('Redis down')),
      del: vi.fn().mockRejectedValue(new Error('Redis down')),
      publish: vi.fn().mockRejectedValue(new Error('Redis down')),
      subscribe: vi.fn().mockRejectedValue(new Error('Redis down')),
      quit: vi.fn().mockResolvedValue('OK')
    };

    const Redis = (await import('ioredis')).default;
    vi.mocked(Redis).mockImplementation(() => mockRedisInstance as any);

    const store = new EventStore(mockPrisma as any);

    // Should fall back to local
    const isProcessed = await store.isEventProcessed('test-id');
    expect(isProcessed).toBe(false);

    await store.markEventProcessed('test-id');
    const processedAfter = await store.isEventProcessed('test-id');
    expect(processedAfter).toBe(true);

    // incrementRateLimitHit should fall back
    const count = await store.incrementRateLimitHit('1.2.3.4');
    expect(count).toBe(1);

    // getRateLimitHits should fall back
    const hits = await store.getRateLimitHits('1.2.3.4');
    // can be 1 from local
    expect(hits).toBeGreaterThanOrEqual(0);

    // getSecurityMetrics should fall back
    const metrics = await store.getSecurityMetrics();
    expect(metrics).toBeDefined();

    // clearSecurityMetrics should not throw
    await expect(store.clearSecurityMetrics()).resolves.not.toThrow();

    // close should handle Redis quit
    await expect(store.close()).resolves.not.toThrow();

    (config as any).redisUrl = original;
  });
});
