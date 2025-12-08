import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { tokenRequired, roleRequired, optionalAuth } from '../../../src/middleware/auth.middleware.js';
import { container } from '../../../src/container.js';
import { AuthenticationError, AuthorizationError } from '../../../src/utils/exceptions.js';
import { UserRole } from '../../../src/models/user.model.js';

vi.mock('../../../src/container.js', () => ({
  container: {
    get: vi.fn()
  }
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockAuthService: { validateToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: undefined
    };
    mockRes = {};
    mockNext = vi.fn();

    mockAuthService = {
      validateToken: vi.fn()
    };

    vi.mocked(container.get).mockReturnValue(mockAuthService);
  });

  describe('tokenRequired', () => {
    it('should authenticate valid bearer token', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.USER
      };

      mockReq.headers = { authorization: 'Bearer valid-token' };
      mockAuthService.validateToken.mockResolvedValue(mockUser);

      await tokenRequired(mockReq as Request, mockRes as Response, mockNext);

      expect(container.get).toHaveBeenCalledWith('authService');
      expect(mockAuthService.validateToken).toHaveBeenCalledWith('valid-token');
      expect(mockReq.user).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.USER
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject missing authorization header', async () => {
      mockReq.headers = {};

      await tokenRequired(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Missing or invalid authorization header');
    });

    it('should reject non-bearer authorization header', async () => {
      mockReq.headers = { authorization: 'Basic credentials' };

      await tokenRequired(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should reject empty authorization header', async () => {
      mockReq.headers = { authorization: '' };

      await tokenRequired(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should pass validation errors to next', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      const validationError = new AuthenticationError('Token expired');
      mockAuthService.validateToken.mockRejectedValue(validationError);

      await tokenRequired(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(validationError);
    });

    it('should pass unexpected errors to next', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token' };
      const unexpectedError = new Error('Database connection failed');
      mockAuthService.validateToken.mockRejectedValue(unexpectedError);

      await tokenRequired(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(unexpectedError);
    });
  });

  describe('roleRequired', () => {
    it('should allow user with required role', () => {
      mockReq.user = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        role: UserRole.ADMIN
      };

      const middleware = roleRequired([UserRole.ADMIN]);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow user with one of multiple allowed roles', () => {
      mockReq.user = {
        id: 1,
        username: 'user',
        email: 'user@example.com',
        role: UserRole.USER
      };

      const middleware = roleRequired([UserRole.ADMIN, UserRole.USER]);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user without required role', () => {
      mockReq.user = {
        id: 1,
        username: 'user',
        email: 'user@example.com',
        role: UserRole.USER
      };

      const middleware = roleRequired([UserRole.ADMIN]);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Insufficient permissions');
    });

    it('should reject unauthenticated user', () => {
      mockReq.user = undefined;

      const middleware = roleRequired([UserRole.USER]);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Authentication required');
    });
  });

  describe('optionalAuth', () => {
    it('should authenticate valid bearer token', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.USER
      };

      mockReq.headers = { authorization: 'Bearer valid-token' };
      mockAuthService.validateToken.mockResolvedValue(mockUser);

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.USER
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user for missing header', async () => {
      mockReq.headers = {};

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user for non-bearer header', async () => {
      mockReq.headers = { authorization: 'Basic credentials' };

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user for invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      mockAuthService.validateToken.mockRejectedValue(new AuthenticationError('Invalid token'));

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should pass unexpected errors to next', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token' };

      // Simulate an error outside the inner try-catch
      vi.mocked(container.get).mockImplementation(() => {
        throw new Error('Container error');
      });

      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
