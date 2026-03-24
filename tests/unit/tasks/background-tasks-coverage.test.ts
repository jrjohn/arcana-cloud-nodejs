/**
 * Additional tests for src/tasks/background.tasks.ts
 *
 * Covers: processBackgroundJob (switch cases), handleSendEmail,
 * handleUserRegistration, handleExportUserData, handleWebhookDelivery,
 * shutdownBackgroundTasks
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock queue module - needs to capture the worker processor callback
let capturedProcessors: Map<string, (job: any) => Promise<any>> = new Map();

vi.mock('../../../src/tasks/queue.js', () => ({
  createQueue: vi.fn(),
  createWorker: vi.fn().mockImplementation((queueName, processor) => {
    capturedProcessors.set(queueName, processor);
    return {};
  }),
  addJob: vi.fn().mockResolvedValue({ id: 'job-1', name: 'test-job' }),
  addUniqueJob: vi.fn().mockResolvedValue({ id: 'unique-job-1', name: 'test-job' }),
  queues: new Map()
}));

// Mock distributed lock - simulate both lock-acquired and lock-failed scenarios
const mockWithLock = vi.fn();
vi.mock('../../../src/tasks/distributed-lock.js', () => ({
  withLock: (...args: any[]) => mockWithLock(...args)
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/config.js', () => ({
  config: {
    nodeEnv: 'testing',
    redisUrl: null
  }
}));

import {
  initializeBackgroundTasks,
  queueEmail,
  queueUserRegistration,
  queueUserDataExport,
  queueWebhook,
  shutdownBackgroundTasks,
  BACKGROUND_QUEUE_HIGH,
  BACKGROUND_QUEUE_DEFAULT,
  BACKGROUND_QUEUE_LOW,
  BackgroundJobType
} from '../../../src/tasks/background.tasks.js';
import { createWorker, addJob } from '../../../src/tasks/queue.js';
import { logger } from '../../../src/utils/logger.js';

describe('Background Tasks - Extended Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessors.clear();
    // Default: withLock executes the function
    mockWithLock.mockImplementation(async (_name: string, fn: () => Promise<any>) => fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processBackgroundJob via captured worker processor', () => {
    beforeEach(async () => {
      await initializeBackgroundTasks();
    });

    it('should capture worker processors during initialization', () => {
      expect(capturedProcessors.size).toBe(3);
      expect(capturedProcessors.has(BACKGROUND_QUEUE_HIGH)).toBe(true);
      expect(capturedProcessors.has(BACKGROUND_QUEUE_DEFAULT)).toBe(true);
      expect(capturedProcessors.has(BACKGROUND_QUEUE_LOW)).toBe(true);
    });

    it('should handle SEND_EMAIL job', async () => {
      const processor = capturedProcessors.get(BACKGROUND_QUEUE_HIGH)!;

      const result = await processor({
        id: 'job-email-1',
        name: BackgroundJobType.SEND_EMAIL,
        queueName: BACKGROUND_QUEUE_HIGH,
        attemptsMade: 0,
        data: {
          to: 'user@example.com',
          subject: 'Hello',
          template: 'welcome',
          data: { name: 'John' }
        }
      });

      expect(result).toEqual({ sent: true });
      expect(logger.info).toHaveBeenCalledWith(
        { subject: 'Hello' },
        'Sending email to user@example.com'
      );
    });

    it('should handle PROCESS_USER_REGISTRATION job', async () => {
      const processor = capturedProcessors.get(BACKGROUND_QUEUE_HIGH)!;

      const result = await processor({
        id: 'job-reg-1',
        name: BackgroundJobType.PROCESS_USER_REGISTRATION,
        queueName: BACKGROUND_QUEUE_HIGH,
        attemptsMade: 0,
        data: {
          userId: 42,
          email: 'new@example.com',
          username: 'newuser'
        }
      });

      expect(result).toEqual({ processed: true });
      expect(logger.info).toHaveBeenCalledWith(
        'Processing registration for user 42'
      );
      // Should have queued a welcome email via addJob
      expect(addJob).toHaveBeenCalledWith(
        BACKGROUND_QUEUE_HIGH,
        BackgroundJobType.SEND_EMAIL,
        expect.objectContaining({
          to: 'new@example.com',
          subject: 'Welcome to Arcana Cloud',
          template: 'welcome'
        })
      );
    });

    it('should handle PROCESS_USER_REGISTRATION when lock not acquired', async () => {
      mockWithLock.mockResolvedValue(null);

      const processor = capturedProcessors.get(BACKGROUND_QUEUE_HIGH)!;

      const result = await processor({
        id: 'job-reg-2',
        name: BackgroundJobType.PROCESS_USER_REGISTRATION,
        queueName: BACKGROUND_QUEUE_HIGH,
        attemptsMade: 0,
        data: {
          userId: 99,
          email: 'locked@example.com',
          username: 'lockeduser'
        }
      });

      expect(result).toEqual({ processed: false });
    });

    it('should handle EXPORT_USER_DATA job', async () => {
      const processor = capturedProcessors.get(BACKGROUND_QUEUE_LOW)!;

      const result = await processor({
        id: 'job-export-1',
        name: BackgroundJobType.EXPORT_USER_DATA,
        queueName: BACKGROUND_QUEUE_LOW,
        attemptsMade: 0,
        data: {
          userId: 10,
          format: 'json',
          requestId: 'req-123'
        }
      });

      expect(result).toEqual({
        fileUrl: 'https://storage.example.com/exports/req-123.json'
      });
      expect(logger.info).toHaveBeenCalledWith(
        { format: 'json' },
        'Exporting data for user 10'
      );
    });

    it('should handle EXPORT_USER_DATA with CSV format', async () => {
      const processor = capturedProcessors.get(BACKGROUND_QUEUE_LOW)!;

      const result = await processor({
        id: 'job-export-2',
        name: BackgroundJobType.EXPORT_USER_DATA,
        queueName: BACKGROUND_QUEUE_LOW,
        attemptsMade: 0,
        data: {
          userId: 20,
          format: 'csv',
          requestId: 'req-456'
        }
      });

      expect(result).toEqual({
        fileUrl: 'https://storage.example.com/exports/req-456.csv'
      });
    });

    it('should handle EXPORT_USER_DATA when lock not acquired', async () => {
      mockWithLock.mockResolvedValue(null);

      const processor = capturedProcessors.get(BACKGROUND_QUEUE_LOW)!;

      const result = await processor({
        id: 'job-export-3',
        name: BackgroundJobType.EXPORT_USER_DATA,
        queueName: BACKGROUND_QUEUE_LOW,
        attemptsMade: 0,
        data: {
          userId: 30,
          format: 'json',
          requestId: 'req-789'
        }
      });

      expect(result).toEqual({});
    });

    it('should handle WEBHOOK_DELIVERY job', async () => {
      const processor = capturedProcessors.get(BACKGROUND_QUEUE_DEFAULT)!;

      const result = await processor({
        id: 'job-webhook-1',
        name: BackgroundJobType.WEBHOOK_DELIVERY,
        queueName: BACKGROUND_QUEUE_DEFAULT,
        attemptsMade: 0,
        data: {
          url: 'https://hooks.example.com/callback',
          payload: { event: 'user.created' },
          headers: { 'X-Secret': 'abc' }
        }
      });

      expect(result).toEqual({ delivered: true });
      expect(logger.info).toHaveBeenCalledWith(
        'Delivering webhook to https://hooks.example.com/callback'
      );
    });

    it('should handle unknown job type', async () => {
      const processor = capturedProcessors.get(BACKGROUND_QUEUE_DEFAULT)!;

      const result = await processor({
        id: 'job-unknown-1',
        name: 'unknown-job-type',
        queueName: BACKGROUND_QUEUE_DEFAULT,
        attemptsMade: 0,
        data: {}
      });

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Unknown background job type: unknown-job-type'
      );
    });

    it('should log job processing details', async () => {
      const processor = capturedProcessors.get(BACKGROUND_QUEUE_HIGH)!;

      await processor({
        id: 'job-99',
        name: BackgroundJobType.SEND_EMAIL,
        queueName: BACKGROUND_QUEUE_HIGH,
        attemptsMade: 2,
        data: {
          to: 'test@test.com',
          subject: 'Test',
          template: 'test',
          data: {}
        }
      });

      expect(logger.info).toHaveBeenCalledWith(
        { jobId: 'job-99', queue: BACKGROUND_QUEUE_HIGH, attempt: 3 },
        `Processing background job: ${BackgroundJobType.SEND_EMAIL}`
      );
    });
  });

  describe('withLock integration in processUserRegistration', () => {
    it('should call withLock with correct lock name and TTL', async () => {
      await initializeBackgroundTasks();
      const processor = capturedProcessors.get(BACKGROUND_QUEUE_HIGH)!;

      await processor({
        id: 'job-lock-1',
        name: BackgroundJobType.PROCESS_USER_REGISTRATION,
        queueName: BACKGROUND_QUEUE_HIGH,
        attemptsMade: 0,
        data: { userId: 55, email: 'lock@test.com', username: 'lockuser' }
      });

      expect(mockWithLock).toHaveBeenCalledWith(
        'user-registration:55',
        expect.any(Function),
        { ttlMs: 60000 }
      );
    });
  });

  describe('withLock integration in exportUserData', () => {
    it('should call withLock with correct lock name and 5 minute TTL', async () => {
      await initializeBackgroundTasks();
      const processor = capturedProcessors.get(BACKGROUND_QUEUE_LOW)!;

      await processor({
        id: 'job-lock-2',
        name: BackgroundJobType.EXPORT_USER_DATA,
        queueName: BACKGROUND_QUEUE_LOW,
        attemptsMade: 0,
        data: { userId: 77, format: 'csv', requestId: 'req-lock' }
      });

      expect(mockWithLock).toHaveBeenCalledWith(
        'export:req-lock',
        expect.any(Function),
        { ttlMs: 300000 }
      );
    });
  });

  describe('shutdownBackgroundTasks()', () => {
    it('should log shutdown message', async () => {
      await shutdownBackgroundTasks();
      expect(logger.info).toHaveBeenCalledWith('Background tasks shutdown');
    });
  });

  describe('Queue constants', () => {
    it('should export correct queue names', () => {
      expect(BACKGROUND_QUEUE_HIGH).toBe('background-high');
      expect(BACKGROUND_QUEUE_DEFAULT).toBe('background-default');
      expect(BACKGROUND_QUEUE_LOW).toBe('background-low');
    });
  });

  describe('BackgroundJobType enum completeness', () => {
    it('should have all expected job types', () => {
      expect(BackgroundJobType.SEND_EMAIL).toBe('send-email');
      expect(BackgroundJobType.SEND_BULK_EMAIL).toBe('send-bulk-email');
      expect(BackgroundJobType.PROCESS_USER_REGISTRATION).toBe('process-user-registration');
      expect(BackgroundJobType.PROCESS_PASSWORD_RESET).toBe('process-password-reset');
      expect(BackgroundJobType.EXPORT_USER_DATA).toBe('export-user-data');
      expect(BackgroundJobType.SEND_PUSH_NOTIFICATION).toBe('send-push-notification');
      expect(BackgroundJobType.SEND_SMS).toBe('send-sms');
      expect(BackgroundJobType.PROCESS_FILE_UPLOAD).toBe('process-file-upload');
      expect(BackgroundJobType.GENERATE_THUMBNAIL).toBe('generate-thumbnail');
      expect(BackgroundJobType.PROCESS_IMPORT).toBe('process-import');
      expect(BackgroundJobType.SYNC_EXTERNAL_SERVICE).toBe('sync-external-service');
      expect(BackgroundJobType.WEBHOOK_DELIVERY).toBe('webhook-delivery');
    });
  });
});
