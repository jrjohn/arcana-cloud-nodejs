/**
 * Domain Events - Define all domain events in the system
 *
 * Events follow the pattern: [Entity][Action]Event
 * Each event contains all necessary data for handlers to process
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

// Base event interface with versioning and idempotency
export interface DomainEvent<T = unknown> {
  readonly eventId: string;        // UUID for idempotency
  readonly type: string;
  readonly version: number;        // Schema version for evolution
  readonly occurredAt: Date;
  readonly correlationId?: string;
  readonly causationId?: string;   // ID of event that caused this event
  readonly payload: T;
}

// Event metadata for tracking
export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: number;
  ipAddress?: string;
  userAgent?: string;
}

// Current event schema versions
export const EVENT_VERSIONS: Record<string, number> = {
  'user.registered': 1,
  'user.logged_in': 1,
  'user.logged_out': 1,
  'user.updated': 1,
  'user.deleted': 1,
  'user.verified': 1,
  'user.status_changed': 1,
  'user.password_changed': 1,
  'user.password_reset_requested': 1,
  'token.created': 1,
  'token.revoked': 1,
  'token.refreshed': 1,
  'token.all_revoked': 1,
  'system.health_check': 1,
  'security.rate_limit_exceeded': 1,
  'security.alert': 1
};

// ==================== User Events ====================

export interface UserRegisteredPayload {
  userId: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface UserLoggedInPayload {
  userId: number;
  username: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  loginMethod: 'password' | 'oauth' | 'token';
}

export interface UserLoggedOutPayload {
  userId: number;
  tokenId?: number;
  logoutType: 'single' | 'all';
}

export interface UserUpdatedPayload {
  userId: number;
  changes: Record<string, { old: unknown; new: unknown }>;
  updatedBy: number;
}

export interface UserDeletedPayload {
  userId: number;
  deletedBy: number;
  reason?: string;
}

export interface UserVerifiedPayload {
  userId: number;
  verifiedAt: Date;
}

export interface UserStatusChangedPayload {
  userId: number;
  oldStatus: string;
  newStatus: string;
  changedBy: number;
  reason?: string;
}

export interface PasswordChangedPayload {
  userId: number;
  changedBy: number;
  ipAddress?: string;
}

export interface PasswordResetRequestedPayload {
  userId: number;
  email: string;
  resetToken: string;
  expiresAt: Date;
}

// ==================== Token Events ====================

export interface TokenCreatedPayload {
  tokenId: number;
  userId: number;
  tokenType: 'access' | 'refresh';
  expiresAt: Date;
  ipAddress?: string;
}

export interface TokenRevokedPayload {
  tokenId: number;
  userId: number;
  revokedBy: number;
  reason?: string;
}

export interface TokenRefreshedPayload {
  userId: number;
  oldTokenId: number;
  newTokenId: number;
}

export interface AllTokensRevokedPayload {
  userId: number;
  revokedBy: number;
  tokenCount: number;
}

// ==================== System Events ====================

export interface SystemHealthCheckPayload {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, { status: string; latency?: number }>;
}

export interface RateLimitExceededPayload {
  userId?: number;
  ipAddress: string;
  endpoint: string;
  limit: number;
  resetAt: Date;
}

export interface SecurityAlertPayload {
  type: 'brute_force' | 'suspicious_activity' | 'unauthorized_access';
  userId?: number;
  ipAddress: string;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ==================== Event Types Enum ====================

export enum EventType {
  // User events
  USER_REGISTERED = 'user.registered',
  USER_LOGGED_IN = 'user.logged_in',
  USER_LOGGED_OUT = 'user.logged_out',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_VERIFIED = 'user.verified',
  USER_STATUS_CHANGED = 'user.status_changed',
  PASSWORD_CHANGED = 'user.password_changed',
  PASSWORD_RESET_REQUESTED = 'user.password_reset_requested',

  // Token events
  TOKEN_CREATED = 'token.created',
  TOKEN_REVOKED = 'token.revoked',
  TOKEN_REFRESHED = 'token.refreshed',
  ALL_TOKENS_REVOKED = 'token.all_revoked',

  // System events
  SYSTEM_HEALTH_CHECK = 'system.health_check',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit_exceeded',
  SECURITY_ALERT = 'security.alert'
}

// ==================== Zod Schemas for Validation ====================

export const UserRegisteredSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string().min(1).max(50),
  email: z.string().email(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional()
});

export const UserLoggedInSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string().min(1),
  email: z.string().email(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  loginMethod: z.enum(['password', 'oauth', 'token'])
});

export const UserLoggedOutSchema = z.object({
  userId: z.number().int().positive(),
  tokenId: z.number().int().positive().optional(),
  logoutType: z.enum(['single', 'all'])
});

export const PasswordChangedSchema = z.object({
  userId: z.number().int().positive(),
  changedBy: z.number().int().positive(),
  ipAddress: z.string().optional()
});

export const UserStatusChangedSchema = z.object({
  userId: z.number().int().positive(),
  oldStatus: z.string(),
  newStatus: z.string(),
  changedBy: z.number().int().positive(),
  reason: z.string().optional()
});

export const TokenRevokedSchema = z.object({
  tokenId: z.number().int().positive(),
  userId: z.number().int().positive(),
  revokedBy: z.number().int().positive(),
  reason: z.string().optional()
});

export const AllTokensRevokedSchema = z.object({
  userId: z.number().int().positive(),
  revokedBy: z.number().int().positive(),
  tokenCount: z.number().int().nonnegative()
});

export const RateLimitExceededSchema = z.object({
  userId: z.number().int().positive().optional(),
  ipAddress: z.string().ip(),
  endpoint: z.string(),
  limit: z.number().int().positive(),
  resetAt: z.date()
});

export const SecurityAlertSchema = z.object({
  type: z.enum(['brute_force', 'suspicious_activity', 'unauthorized_access']),
  userId: z.number().int().positive().optional(),
  ipAddress: z.string(),
  details: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical'])
});

// Schema registry for validation
export const EVENT_SCHEMAS: Record<string, z.ZodSchema> = {
  [EventType.USER_REGISTERED]: UserRegisteredSchema,
  [EventType.USER_LOGGED_IN]: UserLoggedInSchema,
  [EventType.USER_LOGGED_OUT]: UserLoggedOutSchema,
  [EventType.PASSWORD_CHANGED]: PasswordChangedSchema,
  [EventType.USER_STATUS_CHANGED]: UserStatusChangedSchema,
  [EventType.TOKEN_REVOKED]: TokenRevokedSchema,
  [EventType.ALL_TOKENS_REVOKED]: AllTokensRevokedSchema,
  [EventType.RATE_LIMIT_EXCEEDED]: RateLimitExceededSchema,
  [EventType.SECURITY_ALERT]: SecurityAlertSchema
};

// ==================== Event Factory ====================

export class EventValidationError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly errors: z.ZodError
  ) {
    super(`Event validation failed for ${eventType}: ${errors.message}`);
    this.name = 'EventValidationError';
  }
}

export function createEvent<T>(
  type: EventType,
  payload: T,
  metadata?: EventMetadata,
  options?: { skipValidation?: boolean }
): DomainEvent<T> {
  // Validate payload if schema exists
  if (!options?.skipValidation) {
    const schema = EVENT_SCHEMAS[type];
    if (schema) {
      const result = schema.safeParse(payload);
      if (!result.success) {
        throw new EventValidationError(type, result.error);
      }
    }
  }

  return {
    eventId: randomUUID(),
    type,
    version: EVENT_VERSIONS[type] || 1,
    occurredAt: new Date(),
    correlationId: metadata?.correlationId,
    causationId: metadata?.causationId,
    payload
  };
}

// Type-safe event creators
export const Events = {
  userRegistered: (payload: UserRegisteredPayload, metadata?: EventMetadata) =>
    createEvent(EventType.USER_REGISTERED, payload, metadata),

  userLoggedIn: (payload: UserLoggedInPayload, metadata?: EventMetadata) =>
    createEvent(EventType.USER_LOGGED_IN, payload, metadata),

  userLoggedOut: (payload: UserLoggedOutPayload, metadata?: EventMetadata) =>
    createEvent(EventType.USER_LOGGED_OUT, payload, metadata),

  userUpdated: (payload: UserUpdatedPayload, metadata?: EventMetadata) =>
    createEvent(EventType.USER_UPDATED, payload, metadata),

  userDeleted: (payload: UserDeletedPayload, metadata?: EventMetadata) =>
    createEvent(EventType.USER_DELETED, payload, metadata),

  userVerified: (payload: UserVerifiedPayload, metadata?: EventMetadata) =>
    createEvent(EventType.USER_VERIFIED, payload, metadata),

  userStatusChanged: (payload: UserStatusChangedPayload, metadata?: EventMetadata) =>
    createEvent(EventType.USER_STATUS_CHANGED, payload, metadata),

  passwordChanged: (payload: PasswordChangedPayload, metadata?: EventMetadata) =>
    createEvent(EventType.PASSWORD_CHANGED, payload, metadata),

  passwordResetRequested: (payload: PasswordResetRequestedPayload, metadata?: EventMetadata) =>
    createEvent(EventType.PASSWORD_RESET_REQUESTED, payload, metadata),

  tokenCreated: (payload: TokenCreatedPayload, metadata?: EventMetadata) =>
    createEvent(EventType.TOKEN_CREATED, payload, metadata),

  tokenRevoked: (payload: TokenRevokedPayload, metadata?: EventMetadata) =>
    createEvent(EventType.TOKEN_REVOKED, payload, metadata),

  tokenRefreshed: (payload: TokenRefreshedPayload, metadata?: EventMetadata) =>
    createEvent(EventType.TOKEN_REFRESHED, payload, metadata),

  allTokensRevoked: (payload: AllTokensRevokedPayload, metadata?: EventMetadata) =>
    createEvent(EventType.ALL_TOKENS_REVOKED, payload, metadata),

  rateLimitExceeded: (payload: RateLimitExceededPayload, metadata?: EventMetadata) =>
    createEvent(EventType.RATE_LIMIT_EXCEEDED, payload, metadata),

  securityAlert: (payload: SecurityAlertPayload, metadata?: EventMetadata) =>
    createEvent(EventType.SECURITY_ALERT, payload, metadata)
};
