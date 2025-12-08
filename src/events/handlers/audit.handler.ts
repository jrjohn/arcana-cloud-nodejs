/**
 * Audit Event Handler
 *
 * Logs all domain events for audit trail
 */

import { DomainEvent } from '../domain-events.js';
import { getEventBus } from '../event-bus.js';
import { logger } from '../../utils/logger.js';

// Audit log storage (in production, use persistent storage)
interface AuditLogEntry {
  id: string;
  eventType: string;
  occurredAt: Date;
  correlationId?: string;
  payload: unknown;
  processedAt: Date;
}

const auditLog: AuditLogEntry[] = [];
const MAX_AUDIT_LOG_SIZE = 10000;

/**
 * Register audit event handler
 */
export function registerAuditHandler(): void {
  const eventBus = getEventBus();

  // Global handler to audit all events (sync for immediate logging)
  eventBus.onAll(
    (event: DomainEvent) => {
      const entry: AuditLogEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        eventType: event.type,
        occurredAt: event.occurredAt,
        correlationId: event.correlationId,
        payload: event.payload,
        processedAt: new Date()
      };

      // Store in memory (replace with database in production)
      auditLog.push(entry);

      // Trim old entries
      if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
        auditLog.splice(0, auditLog.length - MAX_AUDIT_LOG_SIZE);
      }

      // Log to structured logger for external systems
      logger.info('Audit event', {
        auditId: entry.id,
        eventType: entry.eventType,
        correlationId: entry.correlationId,
        occurredAt: entry.occurredAt
      });
    },
    { async: false, priority: -10 } // Low priority, run after other handlers, sync for immediate audit
  );

  logger.info('Audit event handler registered');
}

/**
 * Query audit log
 */
export function queryAuditLog(options: {
  eventType?: string;
  correlationId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}): AuditLogEntry[] {
  let results = [...auditLog];

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

  // Sort by most recent first
  results.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  if (options.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Get audit log statistics
 */
export function getAuditStats(): {
  totalEvents: number;
  eventsByType: Record<string, number>;
  oldestEvent?: Date;
  newestEvent?: Date;
} {
  const eventsByType: Record<string, number> = {};

  for (const entry of auditLog) {
    eventsByType[entry.eventType] = (eventsByType[entry.eventType] || 0) + 1;
  }

  return {
    totalEvents: auditLog.length,
    eventsByType,
    oldestEvent: auditLog[0]?.occurredAt,
    newestEvent: auditLog[auditLog.length - 1]?.occurredAt
  };
}

/**
 * Clear audit log (for testing)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}
