/**
 * Audit Log Query Functions
 *
 * Provides backward-compatible query functions that use EventStore.
 * For testing without Redis/database, maintains an in-memory fallback.
 */

import { getEventBus } from '../event-bus.js';
import { EventType } from '../domain-events.js';

// In-memory fallback for testing
interface AuditLogEntry {
  id: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  correlationId?: string;
  payload: unknown;
  processedAt: Date;
}

const inMemoryAuditLog: AuditLogEntry[] = [];
const MAX_IN_MEMORY_SIZE = 10000;

/**
 * Add entry to in-memory audit log (called by handler for fallback)
 */
export function addToInMemoryAuditLog(entry: AuditLogEntry): void {
  inMemoryAuditLog.push(entry);
  if (inMemoryAuditLog.length > MAX_IN_MEMORY_SIZE) {
    inMemoryAuditLog.splice(0, inMemoryAuditLog.length - MAX_IN_MEMORY_SIZE);
  }
}

/**
 * Query audit log
 * Uses EventStore if available, falls back to in-memory
 */
export async function queryAuditLogAsync(options: {
  eventType?: string;
  correlationId?: string;
  userId?: number;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  items: AuditLogEntry[];
  total: number;
}> {
  const eventStore = getEventBus().getEventStore();

  if (eventStore) {
    const result = await eventStore.queryAuditLog(options);
    return {
      items: result.items.map(item => ({
        id: item.id,
        eventId: item.eventId,
        eventType: item.eventType,
        eventVersion: item.eventVersion,
        occurredAt: item.occurredAt,
        correlationId: item.correlationId || undefined,
        payload: item.payload,
        processedAt: item.processedAt
      })),
      total: result.total
    };
  }

  // In-memory fallback
  let results = [...inMemoryAuditLog];

  if (options.eventType) {
    results = results.filter(e => e.eventType === options.eventType);
  }
  if (options.correlationId) {
    results = results.filter(e => e.correlationId === options.correlationId);
  }
  if (options.fromDate) {
    results = results.filter(e => e.occurredAt >= options.fromDate!);
  }
  if (options.toDate) {
    results = results.filter(e => e.occurredAt <= options.toDate!);
  }

  results.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  const total = results.length;
  const offset = options.offset || 0;
  const limit = options.limit || 100;
  results = results.slice(offset, offset + limit);

  return { items: results, total };
}

/**
 * Synchronous query for backward compatibility
 * Note: Only works with in-memory storage
 */
export function queryAuditLog(options: {
  eventType?: string;
  correlationId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}): AuditLogEntry[] {
  let results = [...inMemoryAuditLog];

  if (options.eventType) {
    results = results.filter(e => e.eventType === options.eventType);
  }
  if (options.correlationId) {
    results = results.filter(e => e.correlationId === options.correlationId);
  }
  if (options.fromDate) {
    results = results.filter(e => e.occurredAt >= options.fromDate!);
  }
  if (options.toDate) {
    results = results.filter(e => e.occurredAt <= options.toDate!);
  }

  results.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  if (options.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Get audit log statistics
 */
export async function getAuditStatsAsync(): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  last24Hours: number;
}> {
  const eventStore = getEventBus().getEventStore();

  if (eventStore) {
    return eventStore.getAuditStats();
  }

  // In-memory fallback
  const eventsByType: Record<string, number> = {};
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let last24Hours = 0;

  for (const entry of inMemoryAuditLog) {
    eventsByType[entry.eventType] = (eventsByType[entry.eventType] || 0) + 1;
    if (entry.occurredAt >= yesterday) {
      last24Hours++;
    }
  }

  return {
    totalEvents: inMemoryAuditLog.length,
    eventsByType,
    last24Hours
  };
}

/**
 * Synchronous stats for backward compatibility
 */
export function getAuditStats(): {
  totalEvents: number;
  eventsByType: Record<string, number>;
  oldestEvent?: Date;
  newestEvent?: Date;
} {
  const eventsByType: Record<string, number> = {};

  for (const entry of inMemoryAuditLog) {
    eventsByType[entry.eventType] = (eventsByType[entry.eventType] || 0) + 1;
  }

  return {
    totalEvents: inMemoryAuditLog.length,
    eventsByType,
    oldestEvent: inMemoryAuditLog[0]?.occurredAt,
    newestEvent: inMemoryAuditLog[inMemoryAuditLog.length - 1]?.occurredAt
  };
}

/**
 * Clear audit log (for testing)
 */
export function clearAuditLog(): void {
  inMemoryAuditLog.length = 0;
}

/**
 * Get in-memory audit log (for testing)
 */
export function getInMemoryAuditLog(): AuditLogEntry[] {
  return inMemoryAuditLog;
}
