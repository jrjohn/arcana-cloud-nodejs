import { Job } from 'bullmq';
import { createQueue, createWorker, addJob, addUniqueJob } from './queue.js';
import { withLock } from './distributed-lock.js';
import { logger } from '../utils/logger.js';

// Queue names for different priority levels
export const BACKGROUND_QUEUE_HIGH = 'background-high';
export const BACKGROUND_QUEUE_DEFAULT = 'background-default';
export const BACKGROUND_QUEUE_LOW = 'background-low';

// Job types
export enum BackgroundJobType {
  // Email jobs
  SEND_EMAIL = 'send-email',
  SEND_BULK_EMAIL = 'send-bulk-email',

  // User jobs
  PROCESS_USER_REGISTRATION = 'process-user-registration',
  PROCESS_PASSWORD_RESET = 'process-password-reset',
  EXPORT_USER_DATA = 'export-user-data',

  // Notification jobs
  SEND_PUSH_NOTIFICATION = 'send-push-notification',
  SEND_SMS = 'send-sms',

  // Data processing
  PROCESS_FILE_UPLOAD = 'process-file-upload',
  GENERATE_THUMBNAIL = 'generate-thumbnail',
  PROCESS_IMPORT = 'process-import',

  // Integration jobs
  SYNC_EXTERNAL_SERVICE = 'sync-external-service',
  WEBHOOK_DELIVERY = 'webhook-delivery'
}

// Job data interfaces
export interface SendEmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface UserRegistrationJobData {
  userId: number;
  email: string;
  username: string;
}

export interface WebhookDeliveryJobData {
  url: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  retryCount?: number;
}

export interface ExportUserDataJobData {
  userId: number;
  format: 'json' | 'csv';
  requestId: string;
}

/**
 * Initialize background task queues and workers
 */
export async function initializeBackgroundTasks(): Promise<void> {
  // Create queues for different priorities
  createQueue({ name: BACKGROUND_QUEUE_HIGH });
  createQueue({ name: BACKGROUND_QUEUE_DEFAULT });
  createQueue({
    name: BACKGROUND_QUEUE_LOW,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 }
    }
  });

  // High priority worker - email, notifications
  createWorker<unknown, unknown>(
    BACKGROUND_QUEUE_HIGH,
    async (job: Job) => processBackgroundJob(job),
    { concurrency: 5 }
  );

  // Default priority worker
  createWorker<unknown, unknown>(
    BACKGROUND_QUEUE_DEFAULT,
    async (job: Job) => processBackgroundJob(job),
    { concurrency: 3 }
  );

  // Low priority worker - exports, reports
  createWorker<unknown, unknown>(
    BACKGROUND_QUEUE_LOW,
    async (job: Job) => processBackgroundJob(job),
    {
      concurrency: 1,
      limiter: { max: 10, duration: 60000 } // Rate limit: 10 jobs per minute
    }
  );

  logger.info('Background tasks initialized');
}

/**
 * Process background job based on type
 */
async function processBackgroundJob(job: Job): Promise<unknown> {
  logger.info(`Processing background job: ${job.name}`, {
    jobId: job.id,
    queue: job.queueName,
    attempt: job.attemptsMade + 1
  });

  switch (job.name) {
    case BackgroundJobType.SEND_EMAIL:
      return handleSendEmail(job.data as SendEmailJobData);

    case BackgroundJobType.PROCESS_USER_REGISTRATION:
      return handleUserRegistration(job.data as UserRegistrationJobData);

    case BackgroundJobType.EXPORT_USER_DATA:
      return handleExportUserData(job.data as ExportUserDataJobData);

    case BackgroundJobType.WEBHOOK_DELIVERY:
      return handleWebhookDelivery(job.data as WebhookDeliveryJobData);

    default:
      logger.warn(`Unknown background job type: ${job.name}`);
      return null;
  }
}

/**
 * Handle email sending
 */
async function handleSendEmail(data: SendEmailJobData): Promise<{ sent: boolean }> {
  logger.info(`Sending email to ${data.to}`, { subject: data.subject });

  // Email sending implementation
  // Example: await emailService.send(data);

  return { sent: true };
}

/**
 * Handle new user registration (send welcome email, etc.)
 */
async function handleUserRegistration(data: UserRegistrationJobData): Promise<{ processed: boolean }> {
  logger.info(`Processing registration for user ${data.userId}`);

  // Use distributed lock to ensure only one instance processes this user
  const result = await withLock(
    `user-registration:${data.userId}`,
    async () => {
      // Send welcome email
      await addJob(BACKGROUND_QUEUE_HIGH, BackgroundJobType.SEND_EMAIL, {
        to: data.email,
        subject: 'Welcome to Arcana Cloud',
        template: 'welcome',
        data: { username: data.username }
      });

      // Other registration tasks...
      return { processed: true };
    },
    { ttlMs: 60000 }
  );

  return result || { processed: false };
}

/**
 * Handle user data export
 */
async function handleExportUserData(data: ExportUserDataJobData): Promise<{ fileUrl?: string }> {
  logger.info(`Exporting data for user ${data.userId}`, { format: data.format });

  // Use lock to prevent duplicate exports for same request
  const result = await withLock(
    `export:${data.requestId}`,
    async () => {
      // Export implementation
      // const fileUrl = await exportService.exportUserData(data.userId, data.format);
      return { fileUrl: `https://storage.example.com/exports/${data.requestId}.${data.format}` };
    },
    { ttlMs: 300000 } // 5 minutes for export
  );

  return result || {};
}

/**
 * Handle webhook delivery with retry
 */
async function handleWebhookDelivery(data: WebhookDeliveryJobData): Promise<{ delivered: boolean }> {
  logger.info(`Delivering webhook to ${data.url}`);

  // Webhook delivery implementation
  // Example: await axios.post(data.url, data.payload, { headers: data.headers });

  return { delivered: true };
}

// ==================== Public API ====================

/**
 * Queue an email to be sent
 */
export async function queueEmail(
  to: string,
  subject: string,
  template: string,
  data: Record<string, unknown>
): Promise<Job> {
  return addJob(BACKGROUND_QUEUE_HIGH, BackgroundJobType.SEND_EMAIL, {
    to,
    subject,
    template,
    data
  });
}

/**
 * Queue user registration processing
 * Uses unique job ID to prevent duplicate processing
 */
export async function queueUserRegistration(
  userId: number,
  email: string,
  username: string
): Promise<Job | null> {
  return addUniqueJob(
    BACKGROUND_QUEUE_HIGH,
    BackgroundJobType.PROCESS_USER_REGISTRATION,
    { userId, email, username },
    `user-registration-${userId}` // Unique ID prevents duplicates
  );
}

/**
 * Queue user data export
 */
export async function queueUserDataExport(
  userId: number,
  format: 'json' | 'csv',
  requestId: string
): Promise<Job | null> {
  return addUniqueJob(
    BACKGROUND_QUEUE_LOW,
    BackgroundJobType.EXPORT_USER_DATA,
    { userId, format, requestId },
    `export-${requestId}` // Unique per request
  );
}

/**
 * Queue webhook delivery
 */
export async function queueWebhook(
  url: string,
  payload: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<Job> {
  return addJob(BACKGROUND_QUEUE_DEFAULT, BackgroundJobType.WEBHOOK_DELIVERY, {
    url,
    payload,
    headers
  });
}

/**
 * Shutdown background tasks
 */
export async function shutdownBackgroundTasks(): Promise<void> {
  logger.info('Background tasks shutdown');
}
