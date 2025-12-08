/**
 * Event Bus - Central event dispatcher with sync and async support
 *
 * Features:
 * - Synchronous event handlers (in-process)
 * - Asynchronous event handlers (via BullMQ)
 * - Event persistence for replay
 * - Dead letter queue for failed events
 * - Event filtering and middleware
 */

import { injectable } from 'inversify';
import { Job } from 'bullmq';
import { DomainEvent, EventType } from './domain-events.js';
import { createQueue, createWorker, addJob, queues } from '../tasks/queue.js';
import { logger } from '../utils/logger.js';

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
  asyncQueueName: string;
  deadLetterQueueName: string;
  maxRetries: number;
  retryDelay: number;
}

const defaultConfig: EventBusConfig = {
  enableAsync: true,
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

  constructor(config: Partial<EventBusConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Initialize the event bus with BullMQ queues
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.config.enableAsync) {
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
      correlationId: event.correlationId,
      occurredAt: event.occurredAt
    });

    // Execute middleware chain
    await this.executeMiddleware(event, async () => {
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
    });
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
      { priority: this.getEventPriority(event.type) }
    );

    logger.debug(`Queued async event: ${event.type}`);
  }

  /**
   * Process async event from queue
   */
  private async processAsyncEvent(job: Job<DomainEvent>): Promise<void> {
    const event = job.data;

    logger.info(`Processing async event: ${event.type}`, {
      jobId: job.id,
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

    logger.warn(`Event moved to dead letter queue: ${event.type}`);
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
}

// Singleton instance
let eventBusInstance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

export async function initializeEventBus(config?: Partial<EventBusConfig>): Promise<EventBus> {
  eventBusInstance = new EventBus(config);
  await eventBusInstance.initialize();
  return eventBusInstance;
}

export function resetEventBus(): void {
  eventBusInstance = null;
}
