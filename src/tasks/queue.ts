import { Queue, Worker, Job, QueueEvents, QueueScheduler } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

let connection: Redis | undefined;

export function getRedisConnection(): Redis {
  if (!connection && config.redisUrl) {
    connection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
  }
  if (!connection) {
    throw new Error('Redis connection required for queue functionality');
  }
  return connection;
}

export interface QueueConfig {
  name: string;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: { type: 'exponential' | 'fixed'; delay: number };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  };
}

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 50
};

export const queues: Map<string, Queue> = new Map();
export const workers: Map<string, Worker> = new Map();
export const schedulers: Map<string, QueueScheduler> = new Map();

export function createQueue(queueConfig: QueueConfig): Queue {
  const conn = getRedisConnection();

  if (queues.has(queueConfig.name)) {
    return queues.get(queueConfig.name)!;
  }

  // QueueScheduler handles delayed jobs and retries in distributed environment
  const scheduler = new QueueScheduler(queueConfig.name, { connection: conn });
  schedulers.set(queueConfig.name, scheduler);

  const queue = new Queue(queueConfig.name, {
    connection: conn,
    defaultJobOptions: { ...defaultJobOptions, ...queueConfig.defaultJobOptions }
  });

  queues.set(queueConfig.name, queue);

  const queueEvents = new QueueEvents(queueConfig.name, { connection: conn });

  queueEvents.on('completed', ({ jobId }) => {
    logger.info(`Job ${jobId} completed in queue ${queueConfig.name}`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error(`Job ${jobId} failed in queue ${queueConfig.name}: ${failedReason}`);
  });

  return queue;
}

export function createWorker<T = unknown, R = unknown>(
  queueName: string,
  processor: (job: Job<T>) => Promise<R>,
  options?: { concurrency?: number; limiter?: { max: number; duration: number } }
): Worker<T, R> {
  const conn = getRedisConnection();

  const worker = new Worker<T, R>(queueName, processor, {
    connection: conn,
    concurrency: options?.concurrency || 1,
    limiter: options?.limiter
  });

  worker.on('completed', (job) => {
    logger.info(`Worker completed job ${job.id} in queue ${queueName}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Worker failed job ${job?.id} in queue ${queueName}:`, err);
  });

  worker.on('error', (err) => {
    logger.error(`Worker error in queue ${queueName}:`, err);
  });

  workers.set(queueName, worker);
  return worker;
}

/**
 * Add job with deduplication support
 * Using jobId ensures only one job with same ID exists
 */
export async function addJob<T>(
  queueName: string,
  jobName: string,
  data: T,
  options?: {
    delay?: number;
    priority?: number;
    jobId?: string;  // Unique ID for deduplication
    repeat?: { cron?: string; every?: number; limit?: number };
  }
): Promise<Job<T>> {
  const queue = queues.get(queueName);
  if (!queue) {
    throw new Error(`Queue ${queueName} not found. Create queue first.`);
  }

  return queue.add(jobName, data, {
    delay: options?.delay,
    priority: options?.priority,
    jobId: options?.jobId,
    repeat: options?.repeat
  });
}

/**
 * Add unique job - if job with same ID exists, skip
 */
export async function addUniqueJob<T>(
  queueName: string,
  jobName: string,
  data: T,
  uniqueId: string,
  options?: { delay?: number; priority?: number }
): Promise<Job<T> | null> {
  const queue = queues.get(queueName);
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  // Check if job already exists
  const existingJob = await queue.getJob(uniqueId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state !== 'completed' && state !== 'failed') {
      logger.info(`Job ${uniqueId} already exists in state ${state}, skipping`);
      return null;
    }
  }

  return queue.add(jobName, data, {
    jobId: uniqueId,
    delay: options?.delay,
    priority: options?.priority
  });
}

export async function closeQueues(): Promise<void> {
  for (const [name, worker] of workers) {
    logger.info(`Closing worker for queue ${name}`);
    await worker.close();
  }

  for (const [name, scheduler] of schedulers) {
    logger.info(`Closing scheduler for queue ${name}`);
    await scheduler.close();
  }

  for (const [name, queue] of queues) {
    logger.info(`Closing queue ${name}`);
    await queue.close();
  }

  workers.clear();
  schedulers.clear();
  queues.clear();

  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}
