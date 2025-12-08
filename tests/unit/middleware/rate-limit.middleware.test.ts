import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from '../../../src/middleware/rate-limit.middleware.js';
import { RateLimitError } from '../../../src/utils/exceptions.js';

vi.mock('../../../src/config.js', () => ({
  config: {
    rateLimit: {
      windowMs: 60000,
      max: 100
    }
  }
}));

// Mock express-rate-limit
vi.mock('express-rate-limit', () => ({
  default: vi.fn((options) => {
    // Return a middleware that tracks request counts
    const requestCounts = new Map<string, number>();

    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || 'unknown';
      const count = (requestCounts.get(key) || 0) + 1;
      requestCounts.set(key, count);

      if (count > options.max) {
        options.handler(req, res, next);
      } else {
        next();
      }
    };
  })
}));

describe('Rate Limit Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1'
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  describe('createRateLimiter', () => {
    it('should create rate limiter with default options', () => {
      const limiter = createRateLimiter();
      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    it('should create rate limiter with custom options', () => {
      const limiter = createRateLimiter({
        windowMs: 30000,
        max: 50,
        message: 'Custom rate limit message'
      });
      expect(limiter).toBeDefined();
    });

    it('should allow requests within limit', () => {
      const limiter = createRateLimiter({ max: 5 });

      // First request should pass
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should block requests exceeding limit', () => {
      const limiter = createRateLimiter({ max: 2 });

      // First two requests should pass
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);

      // Reset mock to check third call
      vi.mocked(mockNext).mockClear();

      // Third request should be blocked
      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(RateLimitError));
    });

    it('should use custom error message', () => {
      const customMessage = 'You have exceeded the rate limit';
      const limiter = createRateLimiter({ max: 1, message: customMessage });

      // First request passes
      limiter(mockReq as Request, mockRes as Response, mockNext);

      // Second request should fail with custom message
      vi.mocked(mockNext).mockClear();
      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(RateLimitError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe(customMessage);
    });

    it('should use default error message when not specified', () => {
      const limiter = createRateLimiter({ max: 1 });

      // First request passes
      limiter(mockReq as Request, mockRes as Response, mockNext);

      // Second request should fail
      vi.mocked(mockNext).mockClear();
      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(RateLimitError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Too many requests, please try again later');
    });

    it('should track requests per IP', () => {
      const limiter = createRateLimiter({ max: 2 });

      // Two requests from first IP
      mockReq.ip = '192.168.1.1';
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);

      // Reset and try from different IP
      vi.mocked(mockNext).mockClear();
      mockReq.ip = '192.168.1.2';
      limiter(mockReq as Request, mockRes as Response, mockNext);

      // Should pass because it's a different IP
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('RateLimitError', () => {
    it('should have correct status code', () => {
      const error = new RateLimitError('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
    });

    it('should have correct error code', () => {
      const error = new RateLimitError('Rate limit exceeded');
      expect(error.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should include message', () => {
      const error = new RateLimitError('Too many requests');
      expect(error.message).toBe('Too many requests');
    });
  });
});
