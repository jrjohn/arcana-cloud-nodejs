import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { successResponse, errorResponse, paginatedResponse } from '../../../src/utils/response.js';

describe('Response Utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('successResponse', () => {
    it('should create success response with data', () => {
      const data = { id: 1, name: 'Test' };
      const response = successResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.message).toBe('Success');
      expect(response.timestamp).toBe('2024-01-15T10:00:00.000Z');
      expect(response.requestId).toBeDefined();
    });

    it('should create success response with custom message', () => {
      const response = successResponse({ id: 1 }, 'User created');

      expect(response.message).toBe('User created');
    });

    it('should create success response with custom requestId', () => {
      const response = successResponse({ id: 1 }, 'Success', 'custom-request-id');

      expect(response.requestId).toBe('custom-request-id');
    });

    it('should handle null data', () => {
      const response = successResponse(null, 'Deleted');

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    it('should handle array data', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const response = successResponse(data);

      expect(response.data).toEqual(data);
    });
  });

  describe('errorResponse', () => {
    it('should create error response with defaults', () => {
      const response = errorResponse('Something went wrong');

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Something went wrong');
      expect(response.error.code).toBe('INTERNAL_ERROR');
      expect(response.error.details).toBeUndefined();
      expect(response.timestamp).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should create error response with custom values', () => {
      const details = { field: 'email', reason: 'invalid' };
      const response = errorResponse('Validation error', 400, 'VALIDATION_ERROR', details, 'req-123');

      expect(response.error.message).toBe('Validation error');
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.details).toEqual(details);
      expect(response.requestId).toBe('req-123');
    });
  });

  describe('paginatedResponse', () => {
    it('should create paginated response', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, perPage: 10, total: 50, totalPages: 5 };
      const response = paginatedResponse(items, pagination);

      expect(response.success).toBe(true);
      expect(response.items).toEqual(items);
      expect(response.pagination).toEqual(pagination);
      expect(response.timestamp).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should create paginated response with custom requestId', () => {
      const response = paginatedResponse([], { page: 1, perPage: 10, total: 0, totalPages: 0 }, 'req-456');

      expect(response.requestId).toBe('req-456');
    });

    it('should handle empty items', () => {
      const pagination = { page: 1, perPage: 10, total: 0, totalPages: 0 };
      const response = paginatedResponse([], pagination);

      expect(response.items).toEqual([]);
      expect(response.pagination.total).toBe(0);
    });
  });
});
