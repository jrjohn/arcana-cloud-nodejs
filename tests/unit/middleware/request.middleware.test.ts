import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware, requestLoggerMiddleware } from '../../../src/middleware/request.middleware.js';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'generated-uuid-v4')
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { logger } from '../../../src/utils/logger.js';

describe('Request Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let setHeaderMock: ReturnType<typeof vi.fn>;
  let onMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setHeaderMock = vi.fn();
    onMock = vi.fn();

    mockReq = {
      headers: {},
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      get: vi.fn((header: string) => {
        if (header === 'User-Agent') return 'Test Agent';
        return undefined;
      })
    };
    mockRes = {
      setHeader: setHeaderMock,
      on: onMock,
      statusCode: 200
    };
    mockNext = vi.fn();
  });

  describe('requestIdMiddleware', () => {
    it('should generate new request ID when not provided', () => {
      mockReq.headers = {};

      requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.requestId).toBe('generated-uuid-v4');
      expect(setHeaderMock).toHaveBeenCalledWith('X-Request-ID', 'generated-uuid-v4');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use existing request ID from header', () => {
      mockReq.headers = { 'x-request-id': 'existing-request-id' };

      requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.requestId).toBe('existing-request-id');
      expect(setHeaderMock).toHaveBeenCalledWith('X-Request-ID', 'existing-request-id');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set request ID on response header', () => {
      mockReq.headers = {};

      requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(setHeaderMock).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
    });

    it('should call next without arguments', () => {
      requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requestLoggerMiddleware', () => {
    it('should log request completion on finish', () => {
      mockReq.requestId = 'test-request-id';

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Verify listener was registered
      expect(onMock).toHaveBeenCalledWith('finish', expect.any(Function));

      // Simulate response finish
      const finishHandler = onMock.mock.calls[0][1];
      finishHandler();

      expect(logger.info).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        requestId: 'test-request-id',
        userAgent: 'Test Agent',
        ip: '127.0.0.1',
        duration: expect.stringMatching(/^\d+ms$/)
      }));
    });

    it('should calculate request duration', async () => {
      requestLoggerMiddleware(mockReq as Request, mockRes as Response, mockNext);

      // Simulate response finish immediately
      const finishHandler = onMock.mock.calls[0][1];
      finishHandler();

      expect(logger.info).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        duration: expect.stringMatching(/^\d+ms$/)
      }));

      // Duration should be a valid number (>= 0)
      const logCall = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0];
      const duration = parseInt(logCall[1].duration);
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should call next without arguments', () => {
      requestLoggerMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should log different status codes', () => {
      mockRes.statusCode = 404;

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, mockNext);

      const finishHandler = onMock.mock.calls[0][1];
      finishHandler();

      expect(logger.info).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        statusCode: 404
      }));
    });

    it('should log different HTTP methods', () => {
      mockReq.method = 'POST';

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, mockNext);

      const finishHandler = onMock.mock.calls[0][1];
      finishHandler();

      expect(logger.info).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        method: 'POST'
      }));
    });

    it('should handle missing user agent', () => {
      mockReq.get = vi.fn(() => undefined);

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, mockNext);

      const finishHandler = onMock.mock.calls[0][1];
      finishHandler();

      expect(logger.info).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        userAgent: undefined
      }));
    });

    it('should handle missing IP', () => {
      delete mockReq.ip;

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, mockNext);

      const finishHandler = onMock.mock.calls[0][1];
      finishHandler();

      expect(logger.info).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        ip: undefined
      }));
    });
  });
});
