/**
 * Tests for src/events/handlers/audit.queries.ts
 *
 * Covers: addToInMemoryAuditLog, queryAuditLogAsync, queryAuditLog,
 * getAuditStatsAsync, getAuditStats, clearAuditLog, getInMemoryAuditLog
 * Target: 68 uncovered lines
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

vi.mock('../../../src/tasks/queue.js', () => ({
  createQueue: vi.fn(),
  createWorker: vi.fn(),
  addJob: vi.fn(),
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

import {
  addToInMemoryAuditLog,
  queryAuditLogAsync,
  queryAuditLog,
  getAuditStatsAsync,
  getAuditStats,
  clearAuditLog,
  getInMemoryAuditLog
} from '../../../src/events/handlers/audit.queries.js';
import { resetEventBus } from '../../../src/events/event-bus.js';

function makeEntry(overrides: Partial<{
  id: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  correlationId: string;
  payload: unknown;
  processedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? `audit-${Math.random().toString(36).slice(2)}`,
    eventId: overrides.eventId ?? `evt-${Math.random().toString(36).slice(2)}`,
    eventType: overrides.eventType ?? 'user.registered',
    eventVersion: overrides.eventVersion ?? 1,
    occurredAt: overrides.occurredAt ?? new Date(),
    correlationId: overrides.correlationId,
    payload: overrides.payload ?? { userId: 1 },
    processedAt: overrides.processedAt ?? new Date()
  };
}

describe('Audit Queries Coverage', () => {
  beforeEach(() => {
    clearAuditLog();
    resetEventBus();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('addToInMemoryAuditLog()', () => {
    it('should add entry to audit log', () => {
      const entry = makeEntry();
      addToInMemoryAuditLog(entry);

      const log = getInMemoryAuditLog();
      expect(log.length).toBe(1);
      expect(log[0]).toBe(entry);
    });

    it('should enforce max size limit (10000 entries)', () => {
      // Add more than MAX_IN_MEMORY_SIZE entries
      for (let i = 0; i < 10005; i++) {
        addToInMemoryAuditLog(makeEntry({ id: `entry-${i}` }));
      }

      const log = getInMemoryAuditLog();
      expect(log.length).toBe(10000);
    });

    it('should trim oldest entries when over limit', () => {
      for (let i = 0; i < 10003; i++) {
        addToInMemoryAuditLog(makeEntry({ id: `entry-${i}` }));
      }

      const log = getInMemoryAuditLog();
      // The first 3 entries should have been removed
      expect(log[0].id).toBe('entry-3');
      expect(log[log.length - 1].id).toBe('entry-10002');
    });
  });

  describe('queryAuditLogAsync() - in-memory fallback', () => {
    it('should return all entries when no filters', async () => {
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.registered' }));
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.logged_in' }));

      const result = await queryAuditLogAsync({});
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should filter by eventType', async () => {
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.registered' }));
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.logged_in' }));
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.registered' }));

      const result = await queryAuditLogAsync({ eventType: 'user.registered' });
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should filter by correlationId', async () => {
      addToInMemoryAuditLog(makeEntry({ correlationId: 'corr-1' }));
      addToInMemoryAuditLog(makeEntry({ correlationId: 'corr-2' }));
      addToInMemoryAuditLog(makeEntry({ correlationId: 'corr-1' }));

      const result = await queryAuditLogAsync({ correlationId: 'corr-1' });
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should filter by fromDate', async () => {
      const old = new Date('2024-01-01');
      const recent = new Date('2025-06-01');

      addToInMemoryAuditLog(makeEntry({ occurredAt: old }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: recent }));

      const result = await queryAuditLogAsync({ fromDate: new Date('2025-01-01') });
      expect(result.items.length).toBe(1);
    });

    it('should filter by toDate', async () => {
      const old = new Date('2024-01-01');
      const recent = new Date('2025-06-01');

      addToInMemoryAuditLog(makeEntry({ occurredAt: old }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: recent }));

      const result = await queryAuditLogAsync({ toDate: new Date('2024-06-01') });
      expect(result.items.length).toBe(1);
    });

    it('should filter by fromDate and toDate', async () => {
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2024-01-01') }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2024-06-15') }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2025-01-01') }));

      const result = await queryAuditLogAsync({
        fromDate: new Date('2024-03-01'),
        toDate: new Date('2024-12-31')
      });
      expect(result.items.length).toBe(1);
    });

    it('should sort by occurredAt descending', async () => {
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2024-01-01'), id: 'oldest' }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2025-01-01'), id: 'newest' }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2024-06-01'), id: 'middle' }));

      const result = await queryAuditLogAsync({});
      expect(result.items[0].id).toBe('newest');
      expect(result.items[1].id).toBe('middle');
      expect(result.items[2].id).toBe('oldest');
    });

    it('should apply limit', async () => {
      for (let i = 0; i < 10; i++) {
        addToInMemoryAuditLog(makeEntry());
      }

      const result = await queryAuditLogAsync({ limit: 3 });
      expect(result.items.length).toBe(3);
      expect(result.total).toBe(10);
    });

    it('should apply offset', async () => {
      for (let i = 0; i < 10; i++) {
        addToInMemoryAuditLog(makeEntry({ id: `entry-${i}` }));
      }

      const result = await queryAuditLogAsync({ offset: 5, limit: 3 });
      expect(result.items.length).toBe(3);
      expect(result.total).toBe(10);
    });

    it('should default limit to 100 and offset to 0', async () => {
      for (let i = 0; i < 5; i++) {
        addToInMemoryAuditLog(makeEntry());
      }

      const result = await queryAuditLogAsync({});
      expect(result.items.length).toBe(5);
    });

    it('should combine multiple filters', async () => {
      addToInMemoryAuditLog(makeEntry({
        eventType: 'user.registered',
        correlationId: 'corr-A',
        occurredAt: new Date('2025-03-01')
      }));
      addToInMemoryAuditLog(makeEntry({
        eventType: 'user.logged_in',
        correlationId: 'corr-A',
        occurredAt: new Date('2025-03-01')
      }));
      addToInMemoryAuditLog(makeEntry({
        eventType: 'user.registered',
        correlationId: 'corr-B',
        occurredAt: new Date('2025-03-01')
      }));

      const result = await queryAuditLogAsync({
        eventType: 'user.registered',
        correlationId: 'corr-A'
      });
      expect(result.items.length).toBe(1);
    });
  });

  describe('queryAuditLog() - synchronous', () => {
    it('should return all entries when no filters', () => {
      addToInMemoryAuditLog(makeEntry());
      addToInMemoryAuditLog(makeEntry());

      const results = queryAuditLog({});
      expect(results.length).toBe(2);
    });

    it('should filter by eventType', () => {
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.registered' }));
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.logged_in' }));

      const results = queryAuditLog({ eventType: 'user.registered' });
      expect(results.length).toBe(1);
    });

    it('should filter by correlationId', () => {
      addToInMemoryAuditLog(makeEntry({ correlationId: 'abc' }));
      addToInMemoryAuditLog(makeEntry({ correlationId: 'def' }));

      const results = queryAuditLog({ correlationId: 'abc' });
      expect(results.length).toBe(1);
    });

    it('should filter by fromDate', () => {
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2024-01-01') }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2025-06-01') }));

      const results = queryAuditLog({ fromDate: new Date('2025-01-01') });
      expect(results.length).toBe(1);
    });

    it('should filter by toDate', () => {
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2024-01-01') }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2025-06-01') }));

      const results = queryAuditLog({ toDate: new Date('2024-06-01') });
      expect(results.length).toBe(1);
    });

    it('should sort by occurredAt descending', () => {
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2024-01-01'), id: 'a' }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: new Date('2025-01-01'), id: 'b' }));

      const results = queryAuditLog({});
      expect(results[0].id).toBe('b');
      expect(results[1].id).toBe('a');
    });

    it('should apply limit', () => {
      for (let i = 0; i < 10; i++) {
        addToInMemoryAuditLog(makeEntry());
      }

      const results = queryAuditLog({ limit: 5 });
      expect(results.length).toBe(5);
    });

    it('should return all when no limit', () => {
      for (let i = 0; i < 5; i++) {
        addToInMemoryAuditLog(makeEntry());
      }

      const results = queryAuditLog({});
      expect(results.length).toBe(5);
    });
  });

  describe('getAuditStatsAsync() - in-memory fallback', () => {
    it('should return empty stats when no entries', async () => {
      const stats = await getAuditStatsAsync();
      expect(stats.totalEvents).toBe(0);
      expect(stats.eventsByType).toEqual({});
      expect(stats.last24Hours).toBe(0);
    });

    it('should count total events', async () => {
      addToInMemoryAuditLog(makeEntry());
      addToInMemoryAuditLog(makeEntry());
      addToInMemoryAuditLog(makeEntry());

      const stats = await getAuditStatsAsync();
      expect(stats.totalEvents).toBe(3);
    });

    it('should group events by type', async () => {
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.registered' }));
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.registered' }));
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.logged_in' }));

      const stats = await getAuditStatsAsync();
      expect(stats.eventsByType['user.registered']).toBe(2);
      expect(stats.eventsByType['user.logged_in']).toBe(1);
    });

    it('should count last 24 hours events', async () => {
      const now = new Date();
      const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      addToInMemoryAuditLog(makeEntry({ occurredAt: now }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: now }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: yesterday }));

      const stats = await getAuditStatsAsync();
      expect(stats.last24Hours).toBe(2);
    });
  });

  describe('getAuditStats() - synchronous', () => {
    it('should return empty stats when no entries', () => {
      const stats = getAuditStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.eventsByType).toEqual({});
      expect(stats.oldestEvent).toBeUndefined();
      expect(stats.newestEvent).toBeUndefined();
    });

    it('should count events and group by type', () => {
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.registered' }));
      addToInMemoryAuditLog(makeEntry({ eventType: 'token.created' }));
      addToInMemoryAuditLog(makeEntry({ eventType: 'user.registered' }));

      const stats = getAuditStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByType['user.registered']).toBe(2);
      expect(stats.eventsByType['token.created']).toBe(1);
    });

    it('should report oldest and newest event dates', () => {
      const oldest = new Date('2024-01-01');
      const newest = new Date('2025-06-01');

      addToInMemoryAuditLog(makeEntry({ occurredAt: oldest }));
      addToInMemoryAuditLog(makeEntry({ occurredAt: newest }));

      const stats = getAuditStats();
      expect(stats.oldestEvent).toEqual(oldest);
      expect(stats.newestEvent).toEqual(newest);
    });
  });

  describe('clearAuditLog()', () => {
    it('should clear all entries', () => {
      addToInMemoryAuditLog(makeEntry());
      addToInMemoryAuditLog(makeEntry());

      clearAuditLog();

      const log = getInMemoryAuditLog();
      expect(log.length).toBe(0);
    });
  });

  describe('getInMemoryAuditLog()', () => {
    it('should return the in-memory log array', () => {
      const entry = makeEntry();
      addToInMemoryAuditLog(entry);

      const log = getInMemoryAuditLog();
      expect(log).toContain(entry);
    });
  });
});
