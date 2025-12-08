/**
 * Audit Event Handler
 *
 * Logs all domain events to persistent storage via EventStore.
 * Also maintains in-memory fallback for testing without database/Redis.
 */

import { DomainEvent } from '../domain-events.js';
import { getEventBus } from '../event-bus.js';
import { addToInMemoryAuditLog } from './audit.queries.js';
import { logger } from '../../utils/logger.js';

/**
 * Register audit event handler
 * Primary audit logging is done by EventBus via EventStore when available.
 * This handler provides:
 * 1. Structured logging for external systems
 * 2. In-memory fallback for testing
 */
export function registerAuditHandler(): void {
  const eventBus = getEventBus();

  // Global handler to log all events (sync for immediate logging)
  eventBus.onAll(
    (event: DomainEvent) => {
      // Add to in-memory log for backward compatibility and testing
      addToInMemoryAuditLog({
        id: `audit-${event.eventId}`,
        eventId: event.eventId,
        eventType: event.type,
        eventVersion: event.version,
        occurredAt: event.occurredAt,
        correlationId: event.correlationId,
        payload: event.payload,
        processedAt: new Date()
      });

      // Log to structured logger for external systems (ELK, Datadog, etc.)
      logger.info('Audit event', {
        eventId: event.eventId,
        eventType: event.type,
        eventVersion: event.version,
        correlationId: event.correlationId,
        causationId: event.causationId,
        occurredAt: event.occurredAt
      });
    },
    { async: false, priority: -10 } // Low priority, run after other handlers, sync for immediate audit
  );

  logger.info('Audit event handler registered');
}

// Re-export query functions that now use EventStore
export {
  queryAuditLog,
  getAuditStats,
  clearAuditLog
} from './audit.queries.js';
