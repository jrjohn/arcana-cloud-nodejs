/**
 * Event Store - Persistent storage for events
 *
 * Provides:
 * - Redis-backed idempotency checking
 * - Redis pub/sub for multi-instance event distribution
 * - Database-backed audit log via Prisma
 * - In-memory fallback when Redis unavailable
 */

import { injectable, inject } from 'inversify';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { DomainEvent } from './domain-events.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { TOKENS } from '../di/tokens.js';

// Event store configuration
const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds
const SECURITY_METRICS_TTL = 60 * 60; // 1 hour
const EVENT_CHANNEL = 'domain-events';

export interface EventStoreConfig {
  enableRedis: boolean;
  enableDatabase: boolean;
  idempotencyTtl: number;
}

export interface SecurityMetrics {
  rateLimitHits: Map<string, number>;
  failedLogins: Map<string, { count: number; lastAttempt: Date }>;
}

@injectable()
export class EventStore {
  private redis: Redis | null = null;
  private subscriber: Redis | null = null;
  private localProcessedEvents: Set<string> = new Set();
  private localSecurityMetrics: SecurityMetrics = {
    rateLimitHits: new Map(),
    failedLogins: new Map()
  };
  private eventHandlers: ((event: DomainEvent) => void)[] = [];

  constructor(
    @inject(TOKENS.PrismaClient) private prisma: PrismaClient
  ) {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connections
   */
  private initializeRedis(): void {
    if (!config.redisUrl) {
      logger.warn('Redis URL not configured, using in-memory fallback for event store');
      return;
    }

    try {
      this.redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true
      });

      this.redis.on('error', (err) => {
        logger.error('Event store Redis error:', err);
      });

      this.redis.on('connect', () => {
        logger.info('Event store connected to Redis');
      });

      // Separate connection for pub/sub (Redis requires dedicated connection)
      this.subscriber = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100
      });

      this.subscriber.on('error', (err) => {
        logger.error('Event subscriber Redis error:', err);
      });

    } catch (error) {
      logger.error('Failed to initialize Redis for event store:', error);
    }
  }

  /**
   * Check if event has already been processed (idempotency)
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    if (this.redis) {
      try {
        const exists = await this.redis.exists(`event:processed:${eventId}`);
        return exists === 1;
      } catch (error) {
        logger.error('Redis idempotency check failed, using local:', error);
      }
    }
    return this.localProcessedEvents.has(eventId);
  }

  /**
   * Mark event as processed
   */
  async markEventProcessed(eventId: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.setex(`event:processed:${eventId}`, IDEMPOTENCY_TTL, '1');
        return;
      } catch (error) {
        logger.error('Redis mark processed failed, using local:', error);
      }
    }
    this.localProcessedEvents.add(eventId);
    // Trim local set to prevent memory leak
    if (this.localProcessedEvents.size > 10000) {
      const iterator = this.localProcessedEvents.values();
      for (let i = 0; i < 1000; i++) {
        const first = iterator.next().value;
        if (first) this.localProcessedEvents.delete(first);
      }
    }
  }

  /**
   * Save audit log entry to database
   */
  async saveAuditLog(event: DomainEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          id: `audit-${event.eventId}`,
          eventId: event.eventId,
          eventType: event.type,
          eventVersion: event.version,
          correlationId: event.correlationId,
          payload: event.payload as object,
          occurredAt: event.occurredAt,
          userId: (event.payload as { userId?: number })?.userId,
          ipAddress: (event.payload as { ipAddress?: string })?.ipAddress
        }
      });
    } catch (error) {
      // Log but don't fail - audit is non-critical
      logger.error('Failed to save audit log:', error);
    }
  }

  /**
   * Query audit logs from database
   */
  async queryAuditLog(options: {
    eventType?: string;
    correlationId?: string;
    userId?: number;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: Array<{
      id: string;
      eventId: string;
      eventType: string;
      eventVersion: number;
      correlationId: string | null;
      payload: unknown;
      occurredAt: Date;
      processedAt: Date;
      userId: number | null;
    }>;
    total: number;
  }> {
    const where: Record<string, unknown> = {};

    if (options.eventType) where.eventType = options.eventType;
    if (options.correlationId) where.correlationId = options.correlationId;
    if (options.userId) where.userId = options.userId;
    if (options.fromDate || options.toDate) {
      where.occurredAt = {
        ...(options.fromDate && { gte: options.fromDate }),
        ...(options.toDate && { lte: options.toDate })
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: options.limit || 100,
        skip: options.offset || 0
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return { items, total };
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    last24Hours: number;
  }> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalEvents, eventsByType, last24Hours] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.groupBy({
        by: ['eventType'],
        _count: { eventType: true }
      }),
      this.prisma.auditLog.count({
        where: { occurredAt: { gte: yesterday } }
      })
    ]);

    return {
      totalEvents,
      eventsByType: eventsByType.reduce((acc, item) => {
        acc[item.eventType] = item._count.eventType;
        return acc;
      }, {} as Record<string, number>),
      last24Hours
    };
  }

  /**
   * Increment rate limit hit counter in Redis
   */
  async incrementRateLimitHit(ipAddress: string): Promise<number> {
    const key = `security:ratelimit:${ipAddress}`;

    if (this.redis) {
      try {
        const count = await this.redis.incr(key);
        if (count === 1) {
          await this.redis.expire(key, SECURITY_METRICS_TTL);
        }
        return count;
      } catch (error) {
        logger.error('Redis rate limit increment failed:', error);
      }
    }

    // Fallback to local
    const current = this.localSecurityMetrics.rateLimitHits.get(ipAddress) || 0;
    this.localSecurityMetrics.rateLimitHits.set(ipAddress, current + 1);
    return current + 1;
  }

  /**
   * Get rate limit hits for an IP
   */
  async getRateLimitHits(ipAddress: string): Promise<number> {
    if (this.redis) {
      try {
        const count = await this.redis.get(`security:ratelimit:${ipAddress}`);
        return parseInt(count || '0', 10);
      } catch (error) {
        logger.error('Redis get rate limit failed:', error);
      }
    }
    return this.localSecurityMetrics.rateLimitHits.get(ipAddress) || 0;
  }

  /**
   * Get all security metrics
   */
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys('security:ratelimit:*');
        const rateLimitHits = new Map<string, number>();

        for (const key of keys) {
          const ip = key.replace('security:ratelimit:', '');
          const count = await this.redis.get(key);
          rateLimitHits.set(ip, parseInt(count || '0', 10));
        }

        return { rateLimitHits, failedLogins: new Map() };
      } catch (error) {
        logger.error('Redis get security metrics failed:', error);
      }
    }
    return this.localSecurityMetrics;
  }

  /**
   * Clear security metrics (for testing)
   */
  async clearSecurityMetrics(): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys('security:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        logger.error('Redis clear security metrics failed:', error);
      }
    }
    this.localSecurityMetrics.rateLimitHits.clear();
    this.localSecurityMetrics.failedLogins.clear();
  }

  /**
   * Publish event to Redis pub/sub for multi-instance distribution
   */
  async publishToChannel(event: DomainEvent): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.publish(EVENT_CHANNEL, JSON.stringify(event));
    } catch (error) {
      logger.error('Failed to publish event to Redis channel:', error);
    }
  }

  /**
   * Subscribe to event channel for multi-instance coordination
   */
  async subscribeToChannel(handler: (event: DomainEvent) => void): Promise<void> {
    if (!this.subscriber) {
      logger.warn('Redis subscriber not available, multi-instance sync disabled');
      return;
    }

    this.eventHandlers.push(handler);

    try {
      await this.subscriber.subscribe(EVENT_CHANNEL);

      this.subscriber.on('message', (channel, message) => {
        if (channel === EVENT_CHANNEL) {
          try {
            const event = JSON.parse(message) as DomainEvent;
            // Reconstitute Date objects
            event.occurredAt = new Date(event.occurredAt);
            for (const eventHandler of this.eventHandlers) {
              eventHandler(event);
            }
          } catch (error) {
            logger.error('Failed to parse event from Redis channel:', error);
          }
        }
      });

      logger.info('Subscribed to event channel for multi-instance sync');
    } catch (error) {
      logger.error('Failed to subscribe to Redis channel:', error);
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }

  /**
   * Clear local event cache (for testing)
   */
  clearLocalCache(): void {
    this.localProcessedEvents.clear();
  }
}

// For backward compatibility and testing without DI
let eventStoreInstance: EventStore | null = null;

export function getEventStore(prisma?: PrismaClient): EventStore {
  if (!eventStoreInstance && prisma) {
    eventStoreInstance = new EventStore(prisma);
  }
  if (!eventStoreInstance) {
    throw new Error('EventStore not initialized. Provide PrismaClient or use DI.');
  }
  return eventStoreInstance;
}

export function resetEventStore(): void {
  if (eventStoreInstance) {
    eventStoreInstance.close();
  }
  eventStoreInstance = null;
}
