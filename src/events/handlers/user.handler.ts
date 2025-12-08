/**
 * User Event Handlers
 *
 * Handle user-related domain events
 */

import { DomainEvent, EventType, UserRegisteredPayload, UserLoggedInPayload, PasswordChangedPayload, UserStatusChangedPayload } from '../domain-events.js';
import { getEventBus } from '../event-bus.js';
import { queueEmail, queueUserRegistration } from '../../tasks/background.tasks.js';
import { logger } from '../../utils/logger.js';

/**
 * Register all user event handlers
 */
export function registerUserHandlers(): void {
  const eventBus = getEventBus();

  // ==================== Sync Handlers ====================
  // These run immediately when event is published

  // Log all user events
  eventBus.on(EventType.USER_REGISTERED, (event: DomainEvent<UserRegisteredPayload>) => {
    logger.info('User registered', {
      userId: event.payload.userId,
      username: event.payload.username,
      email: event.payload.email
    });
  });

  eventBus.on(EventType.USER_LOGGED_IN, (event: DomainEvent<UserLoggedInPayload>) => {
    logger.info('User logged in', {
      userId: event.payload.userId,
      username: event.payload.username,
      ipAddress: event.payload.ipAddress,
      loginMethod: event.payload.loginMethod
    });
  });

  eventBus.on(EventType.PASSWORD_CHANGED, (event: DomainEvent<PasswordChangedPayload>) => {
    logger.info('Password changed', {
      userId: event.payload.userId,
      changedBy: event.payload.changedBy
    });
  });

  eventBus.on(EventType.USER_STATUS_CHANGED, (event: DomainEvent<UserStatusChangedPayload>) => {
    logger.info('User status changed', {
      userId: event.payload.userId,
      oldStatus: event.payload.oldStatus,
      newStatus: event.payload.newStatus,
      changedBy: event.payload.changedBy
    });
  });

  // ==================== Async Handlers ====================
  // These are queued and processed in background

  // Send welcome email on registration
  eventBus.on<UserRegisteredPayload>(
    EventType.USER_REGISTERED,
    async (event) => {
      await queueUserRegistration(
        event.payload.userId,
        event.payload.email,
        event.payload.username
      );
    },
    { async: true, priority: 10 }
  );

  // Send security notification on password change
  eventBus.on<PasswordChangedPayload>(
    EventType.PASSWORD_CHANGED,
    async (event) => {
      // Queue security notification email
      await queueEmail(
        '', // Will be resolved from userId
        'Password Changed - Security Alert',
        'security-password-changed',
        {
          userId: event.payload.userId,
          changedAt: event.occurredAt,
          ipAddress: event.payload.ipAddress
        }
      );
    },
    { async: true, priority: 8 }
  );

  // Handle account suspension
  eventBus.on<UserStatusChangedPayload>(
    EventType.USER_STATUS_CHANGED,
    async (event) => {
      if (event.payload.newStatus === 'SUSPENDED') {
        await queueEmail(
          '', // Will be resolved from userId
          'Account Suspended',
          'account-suspended',
          {
            userId: event.payload.userId,
            reason: event.payload.reason,
            suspendedAt: event.occurredAt
          }
        );
      }
    },
    { async: true, priority: 5 }
  );

  logger.info('User event handlers registered');
}
