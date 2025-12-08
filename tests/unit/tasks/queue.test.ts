import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createQueue,
  createWorker,
  addJob,
  addUniqueJob,
  closeQueues,
  queues,
  workers,
  schedulers
} from '../../../src/tasks/queue.js';

// Mock BullMQ
const mockQueue = {
  add: vi.fn(),
  getJob: vi.fn(),
  close: vi.fn()
};

const mockWorker = {
  on: vi.fn(),
  close: vi.fn()
};

const mockScheduler = {
  close: vi.fn()
};

const mockQueueEvents = {
  on: vi.fn()
};

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => mockQueue),
  Worker: vi.fn().mockImplementation(() => mockWorker),
  QueueScheduler: vi.fn().mockImplementation(() => mockScheduler),
  QueueEvents: vi.fn().mockImplementation(() => mockQueueEvents)
}));

// Mock Redis
const mockRedis = {
  quit: vi.fn()
};

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => mockRedis)
}));

vi.mock('../../../src/config.js', () => ({
  config: {
    redisUrl: 'redis://localhost:6379'
  }
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queues.clear();
    workers.clear();
    schedulers.clear();
  });

  afterEach(async () => {
    await closeQueues();
  });

  describe('createQueue', () => {
    it('should create a new queue', () => {
      const queue = createQueue({ name: 'test-queue' });

      expect(queue).toBeDefined();
      expect(queues.has('test-queue')).toBe(true);
    });

    it('should return existing queue if already created', () => {
      const queue1 = createQueue({ name: 'test-queue' });
      const queue2 = createQueue({ name: 'test-queue' });

      expect(queue1).toBe(queue2);
    });

    it('should create scheduler for the queue', () => {
      createQueue({ name: 'test-queue' });

      expect(schedulers.has('test-queue')).toBe(true);
    });

    it('should apply default job options', async () => {
      const { Queue } = await import('bullmq');

      createQueue({ name: 'test-queue' });

      expect(Queue).toHaveBeenCalledWith('test-queue', expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 50
        })
      }));
    });

    it('should merge custom job options', async () => {
      const { Queue } = await import('bullmq');

      createQueue({
        name: 'test-queue',
        defaultJobOptions: {
          attempts: 5,
          removeOnComplete: 50
        }
      });

      expect(Queue).toHaveBeenCalledWith('test-queue', expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          attempts: 5,
          removeOnComplete: 50
        })
      }));
    });

    it('should set up queue events', async () => {
      createQueue({ name: 'test-queue' });

      expect(mockQueueEvents.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockQueueEvents.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });
  });

  describe('createWorker', () => {
    it('should create a new worker', async () => {
      const processor = vi.fn();
      const worker = createWorker('test-queue', processor);

      expect(worker).toBeDefined();
      expect(workers.has('test-queue')).toBe(true);
    });

    it('should set up worker events', () => {
      const processor = vi.fn();
      createWorker('test-queue', processor);

      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should use default concurrency', async () => {
      const { Worker } = await import('bullmq');

      createWorker('test-queue', vi.fn());

      expect(Worker).toHaveBeenCalledWith('test-queue', expect.any(Function), expect.objectContaining({
        concurrency: 1
      }));
    });

    it('should use custom concurrency', async () => {
      const { Worker } = await import('bullmq');

      createWorker('test-queue', vi.fn(), { concurrency: 5 });

      expect(Worker).toHaveBeenCalledWith('test-queue', expect.any(Function), expect.objectContaining({
        concurrency: 5
      }));
    });

    it('should apply rate limiter', async () => {
      const { Worker } = await import('bullmq');

      createWorker('test-queue', vi.fn(), {
        limiter: { max: 10, duration: 60000 }
      });

      expect(Worker).toHaveBeenCalledWith('test-queue', expect.any(Function), expect.objectContaining({
        limiter: { max: 10, duration: 60000 }
      }));
    });
  });

  describe('addJob', () => {
    it('should add job to queue', async () => {
      const mockJob = { id: 'job-1', name: 'test-job' };
      mockQueue.add.mockResolvedValue(mockJob);

      createQueue({ name: 'test-queue' });
      const job = await addJob('test-queue', 'test-job', { data: 'value' });

      expect(mockQueue.add).toHaveBeenCalledWith('test-job', { data: 'value' }, {
        delay: undefined,
        priority: undefined,
        jobId: undefined,
        repeat: undefined
      });
      expect(job).toEqual(mockJob);
    });

    it('should throw error if queue not found', async () => {
      await expect(addJob('non-existent', 'job', {})).rejects.toThrow(
        'Queue non-existent not found'
      );
    });

    it('should add job with delay', async () => {
      createQueue({ name: 'test-queue' });
      await addJob('test-queue', 'test-job', {}, { delay: 5000 });

      expect(mockQueue.add).toHaveBeenCalledWith('test-job', {}, expect.objectContaining({
        delay: 5000
      }));
    });

    it('should add job with priority', async () => {
      createQueue({ name: 'test-queue' });
      await addJob('test-queue', 'test-job', {}, { priority: 1 });

      expect(mockQueue.add).toHaveBeenCalledWith('test-job', {}, expect.objectContaining({
        priority: 1
      }));
    });

    it('should add job with custom ID', async () => {
      createQueue({ name: 'test-queue' });
      await addJob('test-queue', 'test-job', {}, { jobId: 'custom-id' });

      expect(mockQueue.add).toHaveBeenCalledWith('test-job', {}, expect.objectContaining({
        jobId: 'custom-id'
      }));
    });

    it('should add repeating job', async () => {
      createQueue({ name: 'test-queue' });
      await addJob('test-queue', 'test-job', {}, {
        repeat: { cron: '0 * * * *' }
      });

      expect(mockQueue.add).toHaveBeenCalledWith('test-job', {}, expect.objectContaining({
        repeat: { cron: '0 * * * *' }
      }));
    });
  });

  describe('addUniqueJob', () => {
    it('should add unique job if not exists', async () => {
      mockQueue.getJob.mockResolvedValue(null);
      mockQueue.add.mockResolvedValue({ id: 'unique-1' });

      createQueue({ name: 'test-queue' });
      const job = await addUniqueJob('test-queue', 'test-job', { data: 'value' }, 'unique-id');

      expect(mockQueue.getJob).toHaveBeenCalledWith('unique-id');
      expect(mockQueue.add).toHaveBeenCalledWith('test-job', { data: 'value' }, {
        jobId: 'unique-id',
        delay: undefined,
        priority: undefined
      });
      expect(job).not.toBeNull();
    });

    it('should skip if job already exists and active', async () => {
      const existingJob = {
        getState: vi.fn().mockResolvedValue('active')
      };
      mockQueue.getJob.mockResolvedValue(existingJob);

      createQueue({ name: 'test-queue' });
      const job = await addUniqueJob('test-queue', 'test-job', {}, 'unique-id');

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(job).toBeNull();
    });

    it('should skip if job is waiting', async () => {
      const existingJob = {
        getState: vi.fn().mockResolvedValue('waiting')
      };
      mockQueue.getJob.mockResolvedValue(existingJob);

      createQueue({ name: 'test-queue' });
      const job = await addUniqueJob('test-queue', 'test-job', {}, 'unique-id');

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(job).toBeNull();
    });

    it('should add job if existing job is completed', async () => {
      const existingJob = {
        getState: vi.fn().mockResolvedValue('completed')
      };
      mockQueue.getJob.mockResolvedValue(existingJob);
      mockQueue.add.mockResolvedValue({ id: 'unique-1' });

      createQueue({ name: 'test-queue' });
      const job = await addUniqueJob('test-queue', 'test-job', {}, 'unique-id');

      expect(mockQueue.add).toHaveBeenCalled();
      expect(job).not.toBeNull();
    });

    it('should add job if existing job failed', async () => {
      const existingJob = {
        getState: vi.fn().mockResolvedValue('failed')
      };
      mockQueue.getJob.mockResolvedValue(existingJob);
      mockQueue.add.mockResolvedValue({ id: 'unique-1' });

      createQueue({ name: 'test-queue' });
      const job = await addUniqueJob('test-queue', 'test-job', {}, 'unique-id');

      expect(mockQueue.add).toHaveBeenCalled();
      expect(job).not.toBeNull();
    });

    it('should throw error if queue not found', async () => {
      await expect(addUniqueJob('non-existent', 'job', {}, 'id')).rejects.toThrow(
        'Queue non-existent not found'
      );
    });
  });

  describe('closeQueues', () => {
    it('should close all workers, schedulers, and queues', async () => {
      createQueue({ name: 'test-queue-1' });
      createQueue({ name: 'test-queue-2' });
      createWorker('test-queue-1', vi.fn());

      await closeQueues();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockScheduler.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
      expect(queues.size).toBe(0);
      expect(workers.size).toBe(0);
      expect(schedulers.size).toBe(0);
    });

    it('should close Redis connection', async () => {
      createQueue({ name: 'test-queue' });

      await closeQueues();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
