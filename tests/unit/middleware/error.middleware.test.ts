import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from '../../../src/middleware/error.middleware.js';
import {
  APIException,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
} from '../../../src/utils/exceptions.js';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Error Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      path: '/api/test',
      method: 'GET',
      requestId: 'test-request-id'
    };
    mockRes = {
      status: statusMock,
      json: jsonMock
    };
    mockNext = vi.fn();

    // Reset NODE_ENV
    vi.stubEnv('NODE_ENV', 'production');
  });

  describe('errorHandler', () => {
    it('should handle NotFoundError', () => {
      const error = new NotFoundError('User not found');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'User not found',
            code: 'NOT_FOUND'
          }),
          requestId: 'test-request-id'
        })
      );
    });

    it('should handle ValidationError with details', () => {
      const error = new ValidationError('Validation failed', {
        email: 'Invalid email format',
        username: 'Username too short'
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: {
              email: 'Invalid email format',
              username: 'Username too short'
            }
          })
        })
      );
    });

    it('should handle AuthenticationError', () => {
      const error = new AuthenticationError('Invalid token');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Invalid token',
            code: 'AUTHENTICATION_ERROR'
          })
        })
      );
    });

    it('should handle AuthorizationError', () => {
      const error = new AuthorizationError('Insufficient permissions');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Insufficient permissions',
            code: 'AUTHORIZATION_ERROR'
          })
        })
      );
    });

    it('should handle generic APIException', () => {
      const error = new APIException('Custom error', 418, 'TEAPOT_ERROR');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(418);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Custom error',
            code: 'TEAPOT_ERROR'
          })
        })
      );
    });

    it('should handle generic Error in production (hide details)', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = new Error('Database connection failed');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
          })
        })
      );
      // Should NOT include stack in production
      const response = jsonMock.mock.calls[0][0];
      expect(response.error.details).toBeUndefined();
    });

    it('should handle generic Error in development (show details)', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const error = new Error('Database connection failed');
      error.stack = 'Error: Database connection failed\n    at somewhere';

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Database connection failed',
            code: 'INTERNAL_ERROR',
            details: expect.objectContaining({
              stack: expect.stringContaining('Database connection failed')
            })
          })
        })
      );
    });

    it('should include requestId in response', () => {
      const error = new NotFoundError('Not found');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id'
        })
      );
    });

    it('should handle error without requestId', () => {
      delete mockReq.requestId;
      const error = new NotFoundError('Not found');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 response', () => {
      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Resource not found',
            code: 'NOT_FOUND'
          })
        })
      );
    });

    it('should include requestId in 404 response', () => {
      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id'
        })
      );
    });

    it('should handle missing requestId', () => {
      delete mockReq.requestId;

      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Resource not found',
            code: 'NOT_FOUND'
          })
        })
      );
    });
  });
});
