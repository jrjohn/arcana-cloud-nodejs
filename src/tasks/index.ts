import { closeQueues } from './queue.js';
import { closeDistributedLock } from './distributed-lock.js';
import { initializeScheduledTasks, shutdownScheduledTasks } from './scheduled.tasks.js';
import { initializeBackgroundTasks, shutdownBackgroundTasks } from './background.tasks.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export * from './queue.js';
export * from './distributed-lock.js';
export * from './scheduled.tasks.js';
export * from './background.tasks.js';

/**
 * Initialize all task systems
 * Only initializes if Redis is configured
 */
export async function initializeTasks(): Promise<boolean> {
  if (!config.redisUrl) {
    logger.warn('Redis not configured - task system disabled');
    return false;
  }

  try {
    await initializeBackgroundTasks();
    await initializeScheduledTasks();
    logger.info('Task system initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize task system:', error);
    return false;
  }
}

/**
 * Gracefully shutdown all task systems
 */
export async function shutdownTasks(): Promise<void> {
  logger.info('Shutting down task system...');

  try {
    await shutdownScheduledTasks();
    await shutdownBackgroundTasks();
    await closeQueues();
    await closeDistributedLock();
    logger.info('Task system shutdown complete');
  } catch (error) {
    logger.error('Error during task system shutdown:', error);
  }
}
