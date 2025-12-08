/**
 * Events Module
 *
 * Event-driven architecture implementation with:
 * - Domain events for decoupled communication
 * - Sync handlers for immediate processing
 * - Async handlers for background processing via BullMQ
 * - Event middleware for cross-cutting concerns
 * - Persistent audit logging (database)
 * - Redis-backed idempotency and metrics
 * - Redis pub/sub for multi-instance coordination
 * - Zod schema validation
 * - InversifyJS DI integration
 */

// Domain events
export {
  DomainEvent,
  EventType,
  EventMetadata,
  Events,
  createEvent,
  EventValidationError,
  EVENT_VERSIONS,
  EVENT_SCHEMAS,
  // Zod schemas
  UserRegisteredSchema,
  UserLoggedInSchema,
  UserLoggedOutSchema,
  PasswordChangedSchema,
  UserStatusChangedSchema,
  TokenRevokedSchema,
  AllTokensRevokedSchema,
  RateLimitExceededSchema,
  SecurityAlertSchema,
  // User event payloads
  UserRegisteredPayload,
  UserLoggedInPayload,
  UserLoggedOutPayload,
  UserUpdatedPayload,
  UserDeletedPayload,
  UserVerifiedPayload,
  UserStatusChangedPayload,
  PasswordChangedPayload,
  PasswordResetRequestedPayload,
  // Token event payloads
  TokenCreatedPayload,
  TokenRevokedPayload,
  TokenRefreshedPayload,
  AllTokensRevokedPayload,
  // System event payloads
  RateLimitExceededPayload,
  SecurityAlertPayload
} from './domain-events.js';

// Event bus
export {
  EventBus,
  EventBusConfig,
  EventMiddleware,
  SyncEventHandler,
  AsyncEventHandler,
  getEventBus,
  initializeEventBus,
  resetEventBus,
  setEventBusInstance
} from './event-bus.js';

// Event store
export {
  EventStore,
  EventStoreConfig,
  SecurityMetrics,
  getEventStore,
  resetEventStore
} from './event-store.js';

// Event handlers
export {
  registerAllHandlers,
  registerUserHandlers,
  registerSecurityHandlers,
  registerAuditHandler,
  // Metrics and queries (sync for backward compatibility)
  getSecurityMetrics,
  clearSecurityMetrics,
  queryAuditLog,
  getAuditStats,
  clearAuditLog,
  // Async versions
  getSecurityMetricsAsync,
  clearSecurityMetricsAsync,
  queryAuditLogAsync,
  getAuditStatsAsync
} from './handlers/index.js';

// Convenience function to initialize the entire event system
import { PrismaClient } from '@prisma/client';
import { initializeEventBus, EventBusConfig } from './event-bus.js';
import { registerAllHandlers } from './handlers/index.js';
import { logger } from '../utils/logger.js';

export async function initializeEventSystem(
  config?: Partial<EventBusConfig>,
  prisma?: PrismaClient
): Promise<void> {
  await initializeEventBus(config, prisma);
  registerAllHandlers();
  logger.info('Event system initialized', {
    idempotency: config?.enableIdempotency ?? true,
    pubSub: config?.enablePubSub ?? true,
    auditLog: config?.enableAuditLog ?? true
  });
}
