import { describe, it, expect } from 'vitest';
import {
  APIException,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError
} from '../../../src/utils/exceptions.js';

describe('Exceptions', () => {
  describe('APIException', () => {
    it('should create exception with default values', () => {
      const error = new APIException('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.errorCode).toBe('INTERNAL_ERROR');
      expect(error.details).toBeUndefined();
      expect(error.name).toBe('APIException');
    });

    it('should create exception with custom values', () => {
      const details = { field: 'value' };
      const error = new APIException('Custom error', 400, 'CUSTOM_ERROR', details);

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('CUSTOM_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should be an instance of Error', () => {
      const error = new APIException('Test');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have stack trace', () => {
      const error = new APIException('Test');
      expect(error.stack).toBeDefined();
    });
  });

  describe('ValidationError', () => {
    it('should create with default message', () => {
      const error = new ValidationError();

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should create with custom message and details', () => {
      const details = { email: 'Invalid email format' };
      const error = new ValidationError('Invalid input', details);

      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual(details);
    });

    it('should be an instance of APIException', () => {
      const error = new ValidationError();
      expect(error).toBeInstanceOf(APIException);
    });
  });

  describe('AuthenticationError', () => {
    it('should create with default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.errorCode).toBe('AUTHENTICATION_ERROR');
    });

    it('should create with custom message', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('AuthorizationError', () => {
    it('should create with default message', () => {
      const error = new AuthorizationError();

      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.errorCode).toBe('AUTHORIZATION_ERROR');
    });

    it('should create with custom message', () => {
      const error = new AuthorizationError('Insufficient permissions');
      expect(error.message).toBe('Insufficient permissions');
    });
  });

  describe('NotFoundError', () => {
    it('should create with default message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('NOT_FOUND');
    });

    it('should create with custom message', () => {
      const error = new NotFoundError('User not found');
      expect(error.message).toBe('User not found');
    });
  });

  describe('ConflictError', () => {
    it('should create with default message', () => {
      const error = new ConflictError();

      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.errorCode).toBe('CONFLICT');
    });

    it('should create with custom message', () => {
      const error = new ConflictError('Username already taken');
      expect(error.message).toBe('Username already taken');
    });
  });

  describe('RateLimitError', () => {
    it('should create with default message', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should create with custom message', () => {
      const error = new RateLimitError('Please slow down');
      expect(error.message).toBe('Please slow down');
    });
  });
});
