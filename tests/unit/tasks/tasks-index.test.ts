import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/config.js', () => ({
  config: {
    redisUrl: null,
    nodeEnv: 'testing'
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

vi.mock('../../../src/tasks/queue.js', () => ({
  createQueue: vi.fn(),
  createWorker: vi.fn(),
  addJob: vi.fn().mockResolvedValue({ id: 'job-1' }),
  queues: new Map(),
  closeQueues: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/tasks/distributed-lock.js', () => ({
  withLock: vi.fn().mockImplementation(async (_: string, fn: () => Promise<unknown>) => fn()),
  LeaderElection: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined)
  })),
  closeDistributedLock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/tasks/scheduled.tasks.js', () => ({
  initializeScheduledTasks: vi.fn().mockResolvedValue(undefined),
  shutdownScheduledTasks: vi.fn().mockResolvedValue(undefined),
  SCHEDULED_QUEUE: 'scheduled-tasks',
  ScheduledJobType: {
    CLEANUP_EXPIRED_TOKENS: 'cleanup-expired-tokens',
    CLEANUP_INACTIVE_USERS: 'cleanup-inactive-users'
  }
}));

vi.mock('../../../src/tasks/background.tasks.js', () => ({
  initializeBackgroundTasks: vi.fn().mockResolvedValue(undefined),
  shutdownBackgroundTasks: vi.fn().mockResolvedValue(undefined),
  queueEmail: vi.fn().mockResolvedValue({ id: 'email-job' }),
  queueUserRegistration: vi.fn().mockResolvedValue({ id: 'reg-job' }),
  queueWebhook: vi.fn().mockResolvedValue({ id: 'webhook-job' }),
  BACKGROUND_QUEUE_HIGH: 'background-high',
  BACKGROUND_QUEUE_DEFAULT: 'background-default',
  BACKGROUND_QUEUE_LOW: 'background-low'
}));

vi.mock('../../../src/container.js', () => ({
  container: {
    get: vi.fn()
  }
}));

import { initializeTasks, shutdownTasks } from '../../../src/tasks/index.js';
import { initializeBackgroundTasks, shutdownBackgroundTasks } from '../../../src/tasks/background.tasks.js';
import { initializeScheduledTasks, shutdownScheduledTasks } from '../../../src/tasks/scheduled.tasks.js';
import { closeQueues } from '../../../src/tasks/queue.js';
import { closeDistributedLock } from '../../../src/tasks/distributed-lock.js';
import { logger } from '../../../src/utils/logger.js';

describe('Tasks Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeTasks', () => {
    it('should return false and warn when Redis is not configured', async () => {
      const result = await initializeTasks();

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Redis not configured')
      );
    });

    it('should initialize tasks when Redis is configured', async () => {
      // Override the config mock temporarily
      const { config } = await import('../../../src/config.js');
      const originalRedisUrl = (config as any).redisUrl;
      (config as any).redisUrl = 'redis://localhost:6379';

      try {
        const result = await initializeTasks();
        expect(result).toBe(true);
        expect(initializeBackgroundTasks).toHaveBeenCalled();
        expect(initializeScheduledTasks).toHaveBeenCalled();
      } finally {
        (config as any).redisUrl = originalRedisUrl;
      }
    });

    it('should return false when initialization throws', async () => {
      const { config } = await import('../../../src/config.js');
      (config as any).redisUrl = 'redis://localhost:6379';

      vi.mocked(initializeBackgroundTasks).mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await initializeTasks();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
      (config as any).redisUrl = null;
    });
  });

  describe('shutdownTasks', () => {
    it('should call shutdown on all task systems', async () => {
      await shutdownTasks();

      expect(shutdownScheduledTasks).toHaveBeenCalled();
      expect(shutdownBackgroundTasks).toHaveBeenCalled();
      expect(closeQueues).toHaveBeenCalled();
      expect(closeDistributedLock).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      vi.mocked(shutdownScheduledTasks).mockRejectedValueOnce(new Error('Shutdown error'));

      await expect(shutdownTasks()).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
