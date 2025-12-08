import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  initializeScheduledTasks,
  shutdownScheduledTasks,
  triggerScheduledJob,
  SCHEDULED_QUEUE,
  ScheduledJobType
} from '../../../src/tasks/scheduled.tasks.js';

// Mock queue module
vi.mock('../../../src/tasks/queue.js', () => ({
  createQueue: vi.fn(),
  createWorker: vi.fn(),
  addJob: vi.fn().mockResolvedValue({ id: 'job-1' })
}));

// Mock distributed lock
vi.mock('../../../src/tasks/distributed-lock.js', () => ({
  LeaderElection: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getIsLeader: vi.fn().mockReturnValue(true)
  }))
}));

vi.mock('../../../src/container.js', () => ({
  container: {
    get: vi.fn()
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

import { createQueue, createWorker, addJob } from '../../../src/tasks/queue.js';
import { LeaderElection } from '../../../src/tasks/distributed-lock.js';

describe('Scheduled Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await shutdownScheduledTasks();
  });

  describe('initializeScheduledTasks', () => {
    it('should create queue', async () => {
      await initializeScheduledTasks();

      expect(createQueue).toHaveBeenCalledWith({ name: SCHEDULED_QUEUE });
    });

    it('should create worker', async () => {
      await initializeScheduledTasks();

      expect(createWorker).toHaveBeenCalledWith(
        SCHEDULED_QUEUE,
        expect.any(Function),
        { concurrency: 2 }
      );
    });

    it('should start leader election', async () => {
      await initializeScheduledTasks();

      expect(LeaderElection).toHaveBeenCalledWith('scheduled-tasks', expect.objectContaining({
        ttlMs: 30000,
        onBecomeLeader: expect.any(Function),
        onLoseLeadership: expect.any(Function)
      }));

      const mockElection = vi.mocked(LeaderElection).mock.results[0].value;
      expect(mockElection.start).toHaveBeenCalledWith(10000);
    });

    it('should schedule recurring jobs when becoming leader', async () => {
      let onBecomeLeaderCallback: (() => void) | undefined;

      vi.mocked(LeaderElection).mockImplementation((name, options) => {
        onBecomeLeaderCallback = options?.onBecomeLeader;
        return {
          start: vi.fn().mockResolvedValue(undefined),
          stop: vi.fn().mockResolvedValue(undefined),
          getIsLeader: vi.fn().mockReturnValue(true)
        } as unknown as LeaderElection;
      });

      await initializeScheduledTasks();

      // Trigger callback
      onBecomeLeaderCallback?.();

      // Wait for async scheduling
      await vi.waitFor(() => {
        expect(addJob).toHaveBeenCalledTimes(2);
      });

      // Verify cleanup tokens job was scheduled
      expect(addJob).toHaveBeenCalledWith(
        SCHEDULED_QUEUE,
        ScheduledJobType.CLEANUP_EXPIRED_TOKENS,
        expect.objectContaining({
          triggeredAt: expect.any(String)
        }),
        expect.objectContaining({
          repeat: { cron: '0 * * * *' },
          jobId: 'recurring-cleanup-tokens'
        })
      );

      // Verify cleanup users job was scheduled
      expect(addJob).toHaveBeenCalledWith(
        SCHEDULED_QUEUE,
        ScheduledJobType.CLEANUP_INACTIVE_USERS,
        expect.objectContaining({
          inactiveDays: 365,
          triggeredAt: expect.any(String)
        }),
        expect.objectContaining({
          repeat: { cron: '0 2 * * *' },
          jobId: 'recurring-cleanup-users'
        })
      );
    });
  });

  describe('shutdownScheduledTasks', () => {
    it('should stop leader election', async () => {
      await initializeScheduledTasks();

      const mockElection = vi.mocked(LeaderElection).mock.results[0].value;

      await shutdownScheduledTasks();

      expect(mockElection.stop).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      // Should not throw
      await shutdownScheduledTasks();
    });
  });

  describe('triggerScheduledJob', () => {
    beforeEach(async () => {
      await initializeScheduledTasks();
    });

    it('should trigger cleanup tokens job', async () => {
      const job = await triggerScheduledJob(ScheduledJobType.CLEANUP_EXPIRED_TOKENS);

      expect(addJob).toHaveBeenCalledWith(
        SCHEDULED_QUEUE,
        ScheduledJobType.CLEANUP_EXPIRED_TOKENS,
        expect.objectContaining({
          triggeredAt: expect.any(String),
          manual: true
        }),
        expect.objectContaining({
          jobId: expect.stringContaining('manual-cleanup-expired-tokens')
        })
      );
      expect(job).toBeDefined();
    });

    it('should trigger cleanup users job', async () => {
      await triggerScheduledJob(ScheduledJobType.CLEANUP_INACTIVE_USERS, { inactiveDays: 30 });

      expect(addJob).toHaveBeenCalledWith(
        SCHEDULED_QUEUE,
        ScheduledJobType.CLEANUP_INACTIVE_USERS,
        expect.objectContaining({
          inactiveDays: 30,
          triggeredAt: expect.any(String),
          manual: true
        }),
        expect.any(Object)
      );
    });

    it('should trigger report generation job', async () => {
      await triggerScheduledJob(ScheduledJobType.GENERATE_REPORTS);

      expect(addJob).toHaveBeenCalledWith(
        SCHEDULED_QUEUE,
        ScheduledJobType.GENERATE_REPORTS,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should include unique job ID with timestamp', async () => {
      await triggerScheduledJob(ScheduledJobType.SYNC_DATA);

      expect(addJob).toHaveBeenCalledWith(
        SCHEDULED_QUEUE,
        ScheduledJobType.SYNC_DATA,
        expect.any(Object),
        expect.objectContaining({
          jobId: expect.stringMatching(/^manual-sync-data-\d+$/)
        })
      );
    });
  });

  describe('ScheduledJobType', () => {
    it('should have correct job type values', () => {
      expect(ScheduledJobType.CLEANUP_EXPIRED_TOKENS).toBe('cleanup-expired-tokens');
      expect(ScheduledJobType.CLEANUP_INACTIVE_USERS).toBe('cleanup-inactive-users');
      expect(ScheduledJobType.GENERATE_REPORTS).toBe('generate-reports');
      expect(ScheduledJobType.SYNC_DATA).toBe('sync-data');
    });
  });
});
