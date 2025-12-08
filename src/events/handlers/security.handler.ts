/**
 * Security Event Handlers
 *
 * Handle security-related domain events
 */

import { DomainEvent, EventType, TokenRevokedPayload, AllTokensRevokedPayload, RateLimitExceededPayload, SecurityAlertPayload } from '../domain-events.js';
import { getEventBus } from '../event-bus.js';
import { queueWebhook } from '../../tasks/background.tasks.js';
import { logger } from '../../utils/logger.js';

// In-memory security metrics (in production, use Redis)
const securityMetrics = {
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

  // Track rate limit violations
  eventBus.on(EventType.RATE_LIMIT_EXCEEDED, (event: DomainEvent<RateLimitExceededPayload>) => {
    const key = event.payload.ipAddress;
    const currentCount = securityMetrics.rateLimitHits.get(key) || 0;
    securityMetrics.rateLimitHits.set(key, currentCount + 1);

    logger.warn('Rate limit exceeded', {
      userId: event.payload.userId,
      ipAddress: event.payload.ipAddress,
      endpoint: event.payload.endpoint,
      limit: event.payload.limit,
      totalViolations: currentCount + 1
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
        // Send webhook to security monitoring system
        await queueWebhook(
          process.env.SECURITY_WEBHOOK_URL || 'https://security.example.com/alerts',
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
    },
    { async: true, priority: 10 }
  );

  // Track repeated rate limit violations (potential attack)
  eventBus.on<RateLimitExceededPayload>(
    EventType.RATE_LIMIT_EXCEEDED,
    async (event) => {
      const key = event.payload.ipAddress;
      const count = securityMetrics.rateLimitHits.get(key) || 0;

      // If more than 10 violations in a session, escalate to security alert
      if (count >= 10) {
        const { Events } = await import('../domain-events.js');
        await getEventBus().publish(
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
 * Get security metrics (for monitoring)
 */
export function getSecurityMetrics(): {
  failedLogins: Map<string, { count: number; lastAttempt: Date }>;
  rateLimitHits: Map<string, number>;
} {
  return securityMetrics;
}

/**
 * Clear security metrics (for testing)
 */
export function clearSecurityMetrics(): void {
  securityMetrics.failedLogins.clear();
  securityMetrics.rateLimitHits.clear();
}
