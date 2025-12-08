/**
 * Security Event Handlers
 *
 * Handle security-related domain events with Redis-backed metrics.
 */

import { DomainEvent, EventType, TokenRevokedPayload, AllTokensRevokedPayload, RateLimitExceededPayload, SecurityAlertPayload } from '../domain-events.js';
import { getEventBus } from '../event-bus.js';
import { queueWebhook } from '../../tasks/background.tasks.js';
import { logger } from '../../utils/logger.js';

// In-memory fallback metrics (used when EventStore unavailable)
const localSecurityMetrics = {
  failedLogins: new Map<string, { count: number; lastAttempt: Date }>(),
  rateLimitHits: new Map<string, number>()
};

/**
 * Register all security event handlers
 */
export function registerSecurityHandlers(): void {
  const eventBus = getEventBus();

  // ==================== Sync Handlers ====================

  // Track token revocations
  eventBus.on(EventType.TOKEN_REVOKED, (event: DomainEvent<TokenRevokedPayload>) => {
    logger.info('Token revoked', {
      tokenId: event.payload.tokenId,
      userId: event.payload.userId,
      revokedBy: event.payload.revokedBy,
      reason: event.payload.reason
    });
  });

  // Track bulk token revocations (potential security incident)
  eventBus.on(EventType.ALL_TOKENS_REVOKED, (event: DomainEvent<AllTokensRevokedPayload>) => {
    logger.warn('All tokens revoked for user', {
      userId: event.payload.userId,
      revokedBy: event.payload.revokedBy,
      tokenCount: event.payload.tokenCount
    });
  });

  // Track rate limit violations using EventStore
  eventBus.on(EventType.RATE_LIMIT_EXCEEDED, async (event: DomainEvent<RateLimitExceededPayload>) => {
    const key = event.payload.ipAddress;
    const eventStore = eventBus.getEventStore();

    let totalViolations: number;
    if (eventStore) {
      totalViolations = await eventStore.incrementRateLimitHit(key);
    } else {
      const currentCount = localSecurityMetrics.rateLimitHits.get(key) || 0;
      localSecurityMetrics.rateLimitHits.set(key, currentCount + 1);
      totalViolations = currentCount + 1;
    }

    logger.warn('Rate limit exceeded', {
      userId: event.payload.userId,
      ipAddress: event.payload.ipAddress,
      endpoint: event.payload.endpoint,
      limit: event.payload.limit,
      totalViolations
    });
  });

  // Handle security alerts
  eventBus.on(EventType.SECURITY_ALERT, (event: DomainEvent<SecurityAlertPayload>) => {
    logger.error('Security alert', {
      type: event.payload.type,
      severity: event.payload.severity,
      userId: event.payload.userId,
      ipAddress: event.payload.ipAddress,
      details: event.payload.details
    });
  });

  // ==================== Async Handlers ====================

  // Notify security team on critical alerts
  eventBus.on<SecurityAlertPayload>(
    EventType.SECURITY_ALERT,
    async (event) => {
      if (event.payload.severity === 'critical' || event.payload.severity === 'high') {
        const webhookUrl = process.env.SECURITY_WEBHOOK_URL;
        if (webhookUrl) {
          await queueWebhook(
            webhookUrl,
            {
              type: 'security_alert',
              severity: event.payload.severity,
              alertType: event.payload.type,
              userId: event.payload.userId,
              ipAddress: event.payload.ipAddress,
              details: event.payload.details,
              timestamp: event.occurredAt
            },
            { 'X-Alert-Priority': event.payload.severity }
          );
        }
      }
    },
    { async: true, priority: 10 }
  );

  // Track repeated rate limit violations (potential attack)
  eventBus.on<RateLimitExceededPayload>(
    EventType.RATE_LIMIT_EXCEEDED,
    async (event) => {
      const key = event.payload.ipAddress;
      const eventStore = eventBus.getEventStore();

      let count: number;
      if (eventStore) {
        count = await eventStore.getRateLimitHits(key);
      } else {
        count = localSecurityMetrics.rateLimitHits.get(key) || 0;
      }

      // If more than 10 violations, escalate to security alert
      if (count >= 10) {
        const { Events } = await import('../domain-events.js');
        await eventBus.publish(
          Events.securityAlert({
            type: 'brute_force',
            userId: event.payload.userId,
            ipAddress: event.payload.ipAddress,
            details: `IP exceeded rate limit ${count} times on ${event.payload.endpoint}`,
            severity: count >= 50 ? 'critical' : 'high'
          })
        );
      }
    },
    { async: true, priority: 5 }
  );

  logger.info('Security event handlers registered');
}

/**
 * Get security metrics
 * Uses EventStore if available, falls back to local
 */
export async function getSecurityMetricsAsync(): Promise<{
  rateLimitHits: Map<string, number>;
  failedLogins: Map<string, { count: number; lastAttempt: Date }>;
}> {
  const eventStore = getEventBus().getEventStore();

  if (eventStore) {
    return eventStore.getSecurityMetrics();
  }

  return localSecurityMetrics;
}

/**
 * Synchronous getter for backward compatibility
 */
export function getSecurityMetrics(): {
  failedLogins: Map<string, { count: number; lastAttempt: Date }>;
  rateLimitHits: Map<string, number>;
} {
  return localSecurityMetrics;
}

/**
 * Clear security metrics (for testing)
 */
export async function clearSecurityMetricsAsync(): Promise<void> {
  const eventStore = getEventBus().getEventStore();

  if (eventStore) {
    await eventStore.clearSecurityMetrics();
  }

  localSecurityMetrics.failedLogins.clear();
  localSecurityMetrics.rateLimitHits.clear();
}

/**
 * Synchronous clear for backward compatibility
 */
export function clearSecurityMetrics(): void {
  localSecurityMetrics.failedLogins.clear();
  localSecurityMetrics.rateLimitHits.clear();
}
