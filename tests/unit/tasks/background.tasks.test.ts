import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeBackgroundTasks,
  queueEmail,
  queueUserRegistration,
  queueUserDataExport,
  queueWebhook,
  BACKGROUND_QUEUE_HIGH,
  BACKGROUND_QUEUE_DEFAULT,
  BACKGROUND_QUEUE_LOW,
  BackgroundJobType
} from '../../../src/tasks/background.tasks.js';

// Mock queue module
vi.mock('../../../src/tasks/queue.js', () => ({
  createQueue: vi.fn(),
  createWorker: vi.fn(),
  addJob: vi.fn().mockResolvedValue({ id: 'job-1', name: 'test-job' }),
  addUniqueJob: vi.fn().mockResolvedValue({ id: 'unique-job-1', name: 'test-job' })
}));

// Mock distributed lock
vi.mock('../../../src/tasks/distributed-lock.js', () => ({
  withLock: vi.fn().mockImplementation(async (name, fn) => fn())
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import { createQueue, createWorker, addJob, addUniqueJob } from '../../../src/tasks/queue.js';

describe('Background Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeBackgroundTasks', () => {
    it('should create queues for all priority levels', async () => {
      await initializeBackgroundTasks();

      expect(createQueue).toHaveBeenCalledWith({ name: BACKGROUND_QUEUE_HIGH });
      expect(createQueue).toHaveBeenCalledWith({ name: BACKGROUND_QUEUE_DEFAULT });
      expect(createQueue).toHaveBeenCalledWith(expect.objectContaining({
        name: BACKGROUND_QUEUE_LOW,
        defaultJobOptions: expect.objectContaining({
          attempts: 2,
          backoff: { type: 'fixed', delay: 5000 }
        })
      }));
    });

    it('should create workers for all queues', async () => {
      await initializeBackgroundTasks();

      // High priority worker
      expect(createWorker).toHaveBeenCalledWith(
        BACKGROUND_QUEUE_HIGH,
        expect.any(Function),
        { concurrency: 5 }
      );

      // Default priority worker
      expect(createWorker).toHaveBeenCalledWith(
        BACKGROUND_QUEUE_DEFAULT,
        expect.any(Function),
        { concurrency: 3 }
      );

      // Low priority worker with rate limiter
      expect(createWorker).toHaveBeenCalledWith(
        BACKGROUND_QUEUE_LOW,
        expect.any(Function),
        {
          concurrency: 1,
          limiter: { max: 10, duration: 60000 }
        }
      );
    });
  });

  describe('queueEmail', () => {
    it('should queue email to high priority queue', async () => {
      await queueEmail(
        'user@example.com',
        'Test Subject',
        'welcome',
        { name: 'John' }
      );

      expect(addJob).toHaveBeenCalledWith(
        BACKGROUND_QUEUE_HIGH,
        BackgroundJobType.SEND_EMAIL,
        {
          to: 'user@example.com',
          subject: 'Test Subject',
          template: 'welcome',
          data: { name: 'John' }
        }
      );
    });

    it('should return job object', async () => {
      const job = await queueEmail('user@example.com', 'Test', 'test', {});

      expect(job).toBeDefined();
      expect(job.id).toBe('job-1');
    });
  });

  describe('queueUserRegistration', () => {
    it('should queue user registration with unique ID', async () => {
      await queueUserRegistration(123, 'user@example.com', 'testuser');

      expect(addUniqueJob).toHaveBeenCalledWith(
        BACKGROUND_QUEUE_HIGH,
        BackgroundJobType.PROCESS_USER_REGISTRATION,
        {
          userId: 123,
          email: 'user@example.com',
          username: 'testuser'
        },
        'user-registration-123'
      );
    });

    it('should prevent duplicate registration jobs', async () => {
      vi.mocked(addUniqueJob).mockResolvedValueOnce(null);

      const job = await queueUserRegistration(123, 'user@example.com', 'testuser');

      expect(job).toBeNull();
    });
  });

  describe('queueUserDataExport', () => {
    it('should queue user data export to low priority queue', async () => {
      await queueUserDataExport(123, 'json', 'request-456');

      expect(addUniqueJob).toHaveBeenCalledWith(
        BACKGROUND_QUEUE_LOW,
        BackgroundJobType.EXPORT_USER_DATA,
        {
          userId: 123,
          format: 'json',
          requestId: 'request-456'
        },
        'export-request-456'
      );
    });

    it('should support CSV format', async () => {
      await queueUserDataExport(123, 'csv', 'request-789');

      expect(addUniqueJob).toHaveBeenCalledWith(
        BACKGROUND_QUEUE_LOW,
        BackgroundJobType.EXPORT_USER_DATA,
        expect.objectContaining({ format: 'csv' }),
        'export-request-789'
      );
    });

    it('should prevent duplicate export jobs', async () => {
      vi.mocked(addUniqueJob).mockResolvedValueOnce(null);

      const job = await queueUserDataExport(123, 'json', 'request-456');

      expect(job).toBeNull();
    });
  });

  describe('queueWebhook', () => {
    it('should queue webhook to default priority queue', async () => {
      const payload = { event: 'user.created', data: { id: 1 } };
      const headers = { 'X-Webhook-Secret': 'secret' };

      await queueWebhook('https://example.com/webhook', payload, headers);

      expect(addJob).toHaveBeenCalledWith(
        BACKGROUND_QUEUE_DEFAULT,
        BackgroundJobType.WEBHOOK_DELIVERY,
        {
          url: 'https://example.com/webhook',
          payload,
          headers
        }
      );
    });

    it('should work without custom headers', async () => {
      await queueWebhook('https://example.com/webhook', { data: 'test' });

      expect(addJob).toHaveBeenCalledWith(
        BACKGROUND_QUEUE_DEFAULT,
        BackgroundJobType.WEBHOOK_DELIVERY,
        {
          url: 'https://example.com/webhook',
          payload: { data: 'test' },
          headers: undefined
        }
      );
    });
  });

  describe('BackgroundJobType', () => {
    it('should have correct job type values', () => {
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

  describe('Queue constants', () => {
    it('should have correct queue names', () => {
      expect(BACKGROUND_QUEUE_HIGH).toBe('background-high');
      expect(BACKGROUND_QUEUE_DEFAULT).toBe('background-default');
      expect(BACKGROUND_QUEUE_LOW).toBe('background-low');
    });
  });
});
