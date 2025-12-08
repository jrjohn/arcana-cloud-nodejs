/**
 * Event Bus - Central event dispatcher with sync and async support
 *
 * Features:
 * - Synchronous event handlers (in-process)
 * - Asynchronous event handlers (via BullMQ)
 * - Idempotency checking via Redis
 * - Event persistence via database
 * - Redis pub/sub for multi-instance coordination
 * - Event filtering and middleware
 * - DI-integrated with InversifyJS
 */

import { injectable, inject, optional } from 'inversify';
import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { DomainEvent, EventType } from './domain-events.js';
import { EventStore } from './event-store.js';
import { createQueue, createWorker, addJob, queues } from '../tasks/queue.js';
import { logger } from '../utils/logger.js';
import { TOKENS } from '../di/tokens.js';

// Event handler types
export type SyncEventHandler<T = unknown> = (event: DomainEvent<T>) => void | Promise<void>;
export type AsyncEventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

// Handler registration
interface HandlerRegistration<T = unknown> {
  handler: SyncEventHandler<T> | AsyncEventHandler<T>;
  async: boolean;
  priority: number;
}

// Event bus configuration
export interface EventBusConfig {
  enableAsync: boolean;
  enableIdempotency: boolean;
  enablePubSub: boolean;
  enableAuditLog: boolean;
  asyncQueueName: string;
  deadLetterQueueName: string;
  maxRetries: number;
  retryDelay: number;
}

const defaultConfig: EventBusConfig = {
  enableAsync: true,
  enableIdempotency: true,
  enablePubSub: true,
  enableAuditLog: true,
  asyncQueueName: 'events',
  deadLetterQueueName: 'events-dlq',
  maxRetries: 3,
  retryDelay: 1000
};

// Event middleware
export type EventMiddleware = (
  event: DomainEvent,
  next: () => Promise<void>
) => Promise<void>;

@injectable()
export class EventBus {
  private handlers: Map<string, HandlerRegistration[]> = new Map();
  private globalHandlers: HandlerRegistration[] = [];
  private middleware: EventMiddleware[] = [];
  private config: EventBusConfig;
  private initialized = false;
  private eventStore: EventStore | null = null;

  constructor(
    @inject(TOKENS.PrismaClient) @optional() private prisma?: PrismaClient,
    config: Partial<EventBusConfig> = {}
  ) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Set configuration (for non-DI usage)
   */
  configure(config: Partial<EventBusConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Initialize the event bus with BullMQ queues and EventStore
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize EventStore if Prisma is available
    if (this.prisma) {
      this.eventStore = new EventStore(this.prisma);

      // Subscribe to Redis pub/sub for multi-instance sync
      if (this.config.enablePubSub) {
        await this.eventStore.subscribeToChannel((event) => {
          // Process event from other instances (skip idempotency for local handlers)
          this.processLocalHandlers(event).catch((err) => {
            logger.error('Failed to process pub/sub event:', err);
          });
        });
      }
    }

    if (this.config.enableAsync) {
      try {
        // Create event queue
        createQueue({
          name: this.config.asyncQueueName,
          defaultJobOptions: {
            attempts: this.config.maxRetries,
            backoff: { type: 'exponential', delay: this.config.retryDelay },
            removeOnComplete: 100,
            removeOnFail: 50
          }
        });

        // Create dead letter queue
        createQueue({
          name: this.config.deadLetterQueueName,
          defaultJobOptions: {
            removeOnComplete: false,
            removeOnFail: false
          }
        });

        // Create worker for async events
        createWorker<DomainEvent>(
          this.config.asyncQueueName,
          async (job: Job<DomainEvent>) => this.processAsyncEvent(job),
          { concurrency: 5 }
        );

        logger.info('Event bus initialized with async support', {
          queue: this.config.asyncQueueName
        });
      } catch (error) {
        logger.warn('Async event processing not available (Redis required):', error);
        this.config.enableAsync = false;
      }
    }

    this.initialized = true;
  }

  /**
   * Register middleware
   */
  use(middleware: EventMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Subscribe to a specific event type
   */
  on<T>(
    eventType: EventType | string,
    handler: SyncEventHandler<T>,
    options: { async?: boolean; priority?: number } = {}
  ): this {
    const registration: HandlerRegistration<T> = {
      handler,
      async: options.async ?? false,
      priority: options.priority ?? 0
    };

    const handlers = this.handlers.get(eventType) || [];
    handlers.push(registration as HandlerRegistration);
    handlers.sort((a, b) => b.priority - a.priority);
    this.handlers.set(eventType, handlers);

    logger.debug(`Registered handler for event: ${eventType}`, {
      async: registration.async,
      priority: registration.priority
    });

    return this;
  }

  /**
   * Subscribe to all events
   */
  onAll<T>(
    handler: SyncEventHandler<T>,
    options: { async?: boolean; priority?: number } = {}
  ): this {
    const registration: HandlerRegistration<T> = {
      handler,
      async: options.async ?? false,
      priority: options.priority ?? 0
    };

    this.globalHandlers.push(registration as HandlerRegistration);
    this.globalHandlers.sort((a, b) => b.priority - a.priority);

    return this;
  }

  /**
   * Unsubscribe from an event
   */
  off(eventType: EventType | string, handler: SyncEventHandler): this {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.findIndex(h => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
    return this;
  }

  /**
   * Publish an event
   */
  async publish<T>(event: DomainEvent<T>): Promise<void> {
    logger.debug(`Publishing event: ${event.type}`, {
      eventId: event.eventId,
      version: event.version,
      correlationId: event.correlationId
    });

    // Idempotency check
    if (this.config.enableIdempotency && this.eventStore) {
      const isProcessed = await this.eventStore.isEventProcessed(event.eventId);
      if (isProcessed) {
        logger.debug(`Event already processed, skipping: ${event.eventId}`);
        return;
      }
    }

    // Execute middleware chain
    await this.executeMiddleware(event, async () => {
      // Save to audit log
      if (this.config.enableAuditLog && this.eventStore) {
        await this.eventStore.saveAuditLog(event);
      }

      // Mark as processed (idempotency)
      if (this.config.enableIdempotency && this.eventStore) {
        await this.eventStore.markEventProcessed(event.eventId);
      }

      // Publish to Redis pub/sub for other instances
      if (this.config.enablePubSub && this.eventStore) {
        await this.eventStore.publishToChannel(event);
      }

      // Process handlers
      await this.processLocalHandlers(event);
    });
  }

  /**
   * Process handlers for an event
   */
  private async processLocalHandlers<T>(event: DomainEvent<T>): Promise<void> {
    // Get handlers for this event type
    const typeHandlers = this.handlers.get(event.type) || [];
    const allHandlers = [...typeHandlers, ...this.globalHandlers];

    // Separate sync and async handlers
    const syncHandlers = allHandlers.filter(h => !h.async);
    const asyncHandlers = allHandlers.filter(h => h.async);

    // Execute sync handlers immediately
    for (const registration of syncHandlers) {
      try {
        await registration.handler(event);
      } catch (error) {
        logger.error(`Sync handler failed for event: ${event.type}`, { error });
      }
    }

    // Queue async handlers
    if (asyncHandlers.length > 0 && this.config.enableAsync) {
      await this.queueAsyncEvent(event);
    }
  }

  /**
   * Publish multiple events
   */
  async publishAll<T>(events: DomainEvent<T>[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }

  /**
   * Queue event for async processing
   */
  private async queueAsyncEvent<T>(event: DomainEvent<T>): Promise<void> {
    if (!queues.has(this.config.asyncQueueName)) {
      logger.warn('Event queue not initialized, processing synchronously');
      return;
    }

    await addJob(
      this.config.asyncQueueName,
      event.type,
      event,
      {
        priority: this.getEventPriority(event.type),
        jobId: `event-${event.eventId}` // Prevent duplicate jobs
      }
    );

    logger.debug(`Queued async event: ${event.type}`, { eventId: event.eventId });
  }

  /**
   * Process async event from queue
   */
  private async processAsyncEvent(job: Job<DomainEvent>): Promise<void> {
    const event = job.data;

    // Reconstitute Date object
    event.occurredAt = new Date(event.occurredAt);

    logger.info(`Processing async event: ${event.type}`, {
      jobId: job.id,
      eventId: event.eventId,
      attempt: job.attemptsMade + 1
    });

    const typeHandlers = this.handlers.get(event.type) || [];
    const asyncHandlers = [...typeHandlers, ...this.globalHandlers].filter(h => h.async);

    const errors: Error[] = [];

    for (const registration of asyncHandlers) {
      try {
        await registration.handler(event);
      } catch (error) {
        errors.push(error as Error);
        logger.error(`Async handler failed for event: ${event.type}`, { error });
      }
    }

    // If all handlers failed, move to dead letter queue
    if (errors.length === asyncHandlers.length && errors.length > 0) {
      await this.moveToDeadLetter(event, errors);
      throw errors[0]; // Trigger retry
    }
  }

  /**
   * Move failed event to dead letter queue
   */
  private async moveToDeadLetter(event: DomainEvent, errors: Error[]): Promise<void> {
    if (!queues.has(this.config.deadLetterQueueName)) return;

    await addJob(
      this.config.deadLetterQueueName,
      'failed-event',
      {
        event,
        errors: errors.map(e => ({ message: e.message, stack: e.stack })),
        failedAt: new Date()
      }
    );

    logger.warn(`Event moved to dead letter queue: ${event.type}`, {
      eventId: event.eventId
    });
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddleware(
    event: DomainEvent,
    finalHandler: () => Promise<void>
  ): Promise<void> {
    if (this.middleware.length === 0) {
      await finalHandler();
      return;
    }

    let index = 0;
    const next = async (): Promise<void> => {
      index++;
      if (index < this.middleware.length) {
        await this.middleware[index](event, next);
      } else {
        await finalHandler();
      }
    };

    await this.middleware[0](event, next);
  }

  /**
   * Get priority for event type (higher = more important)
   */
  private getEventPriority(eventType: string): number {
    const priorities: Record<string, number> = {
      [EventType.SECURITY_ALERT]: 10,
      [EventType.USER_REGISTERED]: 8,
      [EventType.PASSWORD_CHANGED]: 8,
      [EventType.USER_LOGGED_IN]: 5,
      [EventType.USER_UPDATED]: 3,
      [EventType.TOKEN_CREATED]: 2
    };
    return priorities[eventType] ?? 1;
  }

  /**
   * Get the event store instance
   */
  getEventStore(): EventStore | null {
    return this.eventStore;
  }

  /**
   * Get pending event count
   */
  async getPendingCount(): Promise<number> {
    const queue = queues.get(this.config.asyncQueueName);
    if (!queue) return 0;
    return queue.getWaitingCount();
  }

  /**
   * Get failed event count
   */
  async getFailedCount(): Promise<number> {
    const queue = queues.get(this.config.asyncQueueName);
    if (!queue) return 0;
    return queue.getFailedCount();
  }

  /**
   * Replay failed events from dead letter queue
   */
  async replayDeadLetterEvents(limit = 100): Promise<number> {
    const dlq = queues.get(this.config.deadLetterQueueName);
    if (!dlq) return 0;

    const jobs = await dlq.getJobs(['waiting', 'delayed'], 0, limit);
    let replayed = 0;

    for (const job of jobs) {
      const { event } = job.data as { event: DomainEvent };
      await this.publish(event);
      await job.remove();
      replayed++;
    }

    logger.info(`Replayed ${replayed} events from dead letter queue`);
    return replayed;
  }

  /**
   * Close event bus and release resources
   */
  async close(): Promise<void> {
    if (this.eventStore) {
      await this.eventStore.close();
    }
    this.initialized = false;
  }
}

// Singleton instance for backward compatibility
let eventBusInstance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

export async function initializeEventBus(
  config?: Partial<EventBusConfig>,
  prisma?: PrismaClient
): Promise<EventBus> {
  if (eventBusInstance) {
    await eventBusInstance.close();
  }

  eventBusInstance = new EventBus(prisma, config);
  await eventBusInstance.initialize();
  return eventBusInstance;
}

export function resetEventBus(): void {
  if (eventBusInstance) {
    eventBusInstance.close().catch(() => {});
  }
  eventBusInstance = null;
}

/**
 * Set the singleton instance (for DI integration)
 */
export function setEventBusInstance(instance: EventBus): void {
  eventBusInstance = instance;
}
