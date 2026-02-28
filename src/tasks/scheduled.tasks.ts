import { Job } from 'bullmq';
import { createQueue, createWorker, addJob } from './queue.js';
import { LeaderElection } from './distributed-lock.js';
import { container } from '../container.js';
import { IOAuthTokenRepository } from '../repositories/oauth-token.repository.interface.js';
import { logger } from '../utils/logger.js';

// Queue names
export const SCHEDULED_QUEUE = 'scheduled-tasks';

// Job names
export enum ScheduledJobType {
  CLEANUP_EXPIRED_TOKENS = 'cleanup-expired-tokens',
  CLEANUP_INACTIVE_USERS = 'cleanup-inactive-users',
  GENERATE_REPORTS = 'generate-reports',
  SYNC_DATA = 'sync-data'
}

interface CleanupTokensJobData {
  triggeredAt: string;
}

interface CleanupUsersJobData {
  inactiveDays: number;
  triggeredAt: string;
}

// Leader election instance
let leaderElection: LeaderElection | null = null;

/**
 * Initialize scheduled tasks with leader election
 * Only the leader instance will schedule recurring jobs
 */
export async function initializeScheduledTasks(): Promise<void> {
  // Create queue
  createQueue({ name: SCHEDULED_QUEUE });

  // Create worker (all instances process jobs)
  createWorker<unknown, unknown>(
    SCHEDULED_QUEUE,
    async (job: Job) => {
      return processScheduledJob(job);
    },
    { concurrency: 2 }
  );

  // Start leader election
  leaderElection = new LeaderElection('scheduled-tasks', {
    ttlMs: 30000,
    onBecomeLeader: () => {
      logger.info('This instance is now the scheduler leader');
      scheduleRecurringJobs();
    },
    onLoseLeadership: () => {
      logger.warn('This instance lost scheduler leadership');
    }
  });

  await leaderElection.start(10000);
  logger.info('Scheduled tasks initialized');
}

/**
 * Schedule recurring jobs (only called by leader)
 */
async function scheduleRecurringJobs(): Promise<void> {
  // Clean up expired tokens every hour
  await addJob(
    SCHEDULED_QUEUE,
    ScheduledJobType.CLEANUP_EXPIRED_TOKENS,
    { triggeredAt: new Date().toISOString() },
    {
      repeat: { cron: '0 * * * *' }, // Every hour
      jobId: 'recurring-cleanup-tokens'
    }
  );

  // Clean up inactive users daily at 2 AM
  await addJob(
    SCHEDULED_QUEUE,
    ScheduledJobType.CLEANUP_INACTIVE_USERS,
    { inactiveDays: 365, triggeredAt: new Date().toISOString() },
    {
      repeat: { cron: '0 2 * * *' }, // Daily at 2 AM
      jobId: 'recurring-cleanup-users'
    }
  );

  logger.info('Recurring jobs scheduled');
}

/**
 * Process scheduled job based on type
 */
async function processScheduledJob(job: Job): Promise<unknown> {
  logger.info(`Processing scheduled job: ${job.name}`, { jobId: job.id });

  switch (job.name) {
    case ScheduledJobType.CLEANUP_EXPIRED_TOKENS:
      return handleCleanupExpiredTokens(job.data as CleanupTokensJobData);

    case ScheduledJobType.CLEANUP_INACTIVE_USERS:
      return handleCleanupInactiveUsers(job.data as CleanupUsersJobData);

    case ScheduledJobType.GENERATE_REPORTS:
      return handleGenerateReports(job.data);

    case ScheduledJobType.SYNC_DATA:
      return handleSyncData(job.data);

    default:
      logger.warn(`Unknown scheduled job type: ${job.name}`);
      return null;
  }
}

/**
 * Cleanup expired OAuth tokens
 */
async function handleCleanupExpiredTokens(data: CleanupTokensJobData): Promise<{ deletedCount: number }> {
  logger.info('Starting expired tokens cleanup', { triggeredAt: data.triggeredAt });

  try {
    const tokenRepository = container.get<IOAuthTokenRepository>('oauthTokenRepository');
    const deletedCount = await tokenRepository.deleteExpired();

    logger.info(`Cleaned up ${deletedCount} expired tokens`);
    return { deletedCount };
  } catch (error) {
    logger.error('Failed to cleanup expired tokens:', error);
    throw error;
  }
}

/**
 * Cleanup inactive users (soft delete or mark)
 */
async function handleCleanupInactiveUsers(data: CleanupUsersJobData): Promise<{ processedCount: number }> {
  logger.info('Starting inactive users cleanup', {
    inactiveDays: data.inactiveDays,
    triggeredAt: data.triggeredAt
  });

  // Implementation would mark users as inactive
  // This is a placeholder
  return { processedCount: 0 };
}

/**
 * Generate reports
 */
async function handleGenerateReports(_data: unknown): Promise<unknown> {
  logger.info('Generating reports');
  // Implementation placeholder
  return { generated: true };
}

/**
 * Sync data with external systems
 */
async function handleSyncData(_data: unknown): Promise<unknown> {
  logger.info('Syncing data');
  // Implementation placeholder
  return { synced: true };
}

/**
 * Manually trigger a scheduled job (for testing or admin)
 */
export async function triggerScheduledJob(
  jobType: ScheduledJobType,
  data?: Record<string, unknown>
): Promise<Job> {
  const jobData = {
    ...data,
    triggeredAt: new Date().toISOString(),
    manual: true
  };

  return addJob(SCHEDULED_QUEUE, jobType, jobData, {
    jobId: `manual-${jobType}-${Date.now()}`
  });
}

/**
 * Shutdown scheduled tasks
 */
export async function shutdownScheduledTasks(): Promise<void> {
  if (leaderElection) {
    await leaderElection.stop();
    leaderElection = null;
  }
  logger.info('Scheduled tasks shutdown');
}
