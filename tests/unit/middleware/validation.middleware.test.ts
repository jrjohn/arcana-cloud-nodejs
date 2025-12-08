import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateSchema, validatePagination } from '../../../src/middleware/validation.middleware.js';
import { ValidationError } from '../../../src/utils/exceptions.js';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {}
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  describe('validateSchema', () => {
    const testSchema = z.object({
      body: z.object({
        username: z.string().min(3).max(50),
        email: z.string().email(),
        age: z.number().positive().optional()
      }),
      query: z.object({}).passthrough(),
      params: z.object({}).passthrough()
    });

    it('should pass validation for valid data', async () => {
      mockReq.body = {
        username: 'testuser',
        email: 'test@example.com'
      };

      const middleware = validateSchema(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should pass validation with optional fields', async () => {
      mockReq.body = {
        username: 'testuser',
        email: 'test@example.com',
        age: 25
      };

      const middleware = validateSchema(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail validation for missing required field', async () => {
      mockReq.body = {
        username: 'testuser'
        // missing email
      };

      const middleware = validateSchema(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Validation failed');
      expect(error.details).toHaveProperty('email');
    });

    it('should fail validation for invalid email format', async () => {
      mockReq.body = {
        username: 'testuser',
        email: 'invalid-email'
      };

      const middleware = validateSchema(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.details).toHaveProperty('email');
    });

    it('should fail validation for username too short', async () => {
      mockReq.body = {
        username: 'ab', // less than 3 chars
        email: 'test@example.com'
      };

      const middleware = validateSchema(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.details).toHaveProperty('username');
    });

    it('should fail validation for invalid type', async () => {
      mockReq.body = {
        username: 'testuser',
        email: 'test@example.com',
        age: 'not-a-number'
      };

      const middleware = validateSchema(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should collect multiple validation errors', async () => {
      mockReq.body = {
        username: 'ab', // too short
        email: 'invalid' // invalid format
      };

      const middleware = validateSchema(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(Object.keys(error.details).length).toBeGreaterThanOrEqual(2);
    });

    it('should validate query params', async () => {
      const schemaWithQuery = z.object({
        body: z.object({}).passthrough(),
        query: z.object({
          search: z.string().min(1)
        }),
        params: z.object({}).passthrough()
      });

      mockReq.query = { search: '' };

      const middleware = validateSchema(schemaWithQuery);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should validate route params', async () => {
      const schemaWithParams = z.object({
        body: z.object({}).passthrough(),
        query: z.object({}).passthrough(),
        params: z.object({
          id: z.string().regex(/^\d+$/)
        })
      });

      mockReq.params = { id: 'abc' };

      const middleware = validateSchema(schemaWithParams);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should pass non-Zod errors to next', async () => {
      const errorSchema = {
        parseAsync: vi.fn().mockRejectedValue(new Error('Unexpected error'))
      };

      const middleware = validateSchema(errorSchema as any);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Unexpected error');
    });
  });

  describe('validatePagination', () => {
    it('should use default values when no query params', () => {
      mockReq.query = {};

      const middleware = validatePagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.page).toBe('1');
      expect(mockReq.query!.perPage).toBe('20');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should parse valid pagination values', () => {
      mockReq.query = { page: '3', perPage: '50' };

      const middleware = validatePagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.page).toBe('3');
      expect(mockReq.query!.perPage).toBe('50');
    });

    it('should enforce minimum page value', () => {
      mockReq.query = { page: '0', perPage: '20' };

      const middleware = validatePagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.page).toBe('1');
    });

    it('should enforce minimum perPage value', () => {
      // When perPage is -5, parseInt returns -5, then < 1 check sets it to 1
      mockReq.query = { page: '1', perPage: '-5' };

      const middleware = validatePagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.perPage).toBe('1');
    });

    it('should use default for zero perPage', () => {
      // When perPage is 0, parseInt returns 0, then || 20 fallback gives 20
      mockReq.query = { page: '1', perPage: '0' };

      const middleware = validatePagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.perPage).toBe('20');
    });

    it('should enforce default maximum perPage', () => {
      mockReq.query = { page: '1', perPage: '500' };

      const middleware = validatePagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.perPage).toBe('100');
    });

    it('should use custom maxPerPage option', () => {
      mockReq.query = { page: '1', perPage: '30' };

      const middleware = validatePagination({ maxPerPage: 25 });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.perPage).toBe('25');
    });

    it('should handle negative page values', () => {
      mockReq.query = { page: '-5', perPage: '20' };

      const middleware = validatePagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.page).toBe('1');
    });

    it('should handle negative perPage values', () => {
      mockReq.query = { page: '1', perPage: '-10' };

      const middleware = validatePagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.perPage).toBe('1');
    });

    it('should handle non-numeric page values', () => {
      mockReq.query = { page: 'abc', perPage: '20' };

      const middleware = validatePagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.page).toBe('1');
    });

    it('should handle non-numeric perPage values', () => {
      mockReq.query = { page: '1', perPage: 'xyz' };

      const middleware = validatePagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query!.perPage).toBe('20');
    });
  });
});
