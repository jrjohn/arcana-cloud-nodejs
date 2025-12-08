/**
 * Events Module
 *
 * Event-driven architecture implementation using BullMQ
 *
 * Features:
 * - Domain events for decoupled communication
 * - Sync handlers for immediate processing
 * - Async handlers for background processing via BullMQ
 * - Event middleware for cross-cutting concerns
 * - Audit logging for all events
 * - Dead letter queue for failed events
 */

// Domain events
export {
  DomainEvent,
  EventType,
  EventMetadata,
  Events,
  createEvent,
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
  resetEventBus
} from './event-bus.js';

// Event handlers
export {
  registerAllHandlers,
  registerUserHandlers,
  registerSecurityHandlers,
  registerAuditHandler,
  // Metrics and queries
  getSecurityMetrics,
  clearSecurityMetrics,
  queryAuditLog,
  getAuditStats,
  clearAuditLog
} from './handlers/index.js';

// Convenience function to initialize the entire event system
import { initializeEventBus, EventBusConfig } from './event-bus.js';
import { registerAllHandlers } from './handlers/index.js';
import { logger } from '../utils/logger.js';

export async function initializeEventSystem(config?: Partial<EventBusConfig>): Promise<void> {
  await initializeEventBus(config);
  registerAllHandlers();
  logger.info('Event system initialized');
}
