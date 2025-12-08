import { describe, it, expect } from 'vitest';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '../../../src/schemas/auth.schema.js';

describe('Auth Schemas', () => {
  describe('RegisterSchema', () => {
    it('should validate valid registration data', async () => {
      const validData = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test@1234',
          firstName: 'Test',
          lastName: 'User'
        }
      };

      const result = await RegisterSchema.parseAsync(validData);
      expect(result.body.username).toBe('testuser');
      expect(result.body.email).toBe('test@example.com');
    });

    it('should validate without optional fields', async () => {
      const validData = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test@1234'
        }
      };

      const result = await RegisterSchema.parseAsync(validData);
      expect(result.body.firstName).toBeUndefined();
    });

    it('should reject username shorter than 3 characters', async () => {
      const invalidData = {
        body: {
          username: 'ab',
          email: 'test@example.com',
          password: 'Test@1234'
        }
      };

      await expect(RegisterSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject username with special characters', async () => {
      const invalidData = {
        body: {
          username: 'test@user',
          email: 'test@example.com',
          password: 'Test@1234'
        }
      };

      await expect(RegisterSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject invalid email', async () => {
      const invalidData = {
        body: {
          username: 'testuser',
          email: 'invalid-email',
          password: 'Test@1234'
        }
      };

      await expect(RegisterSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject password without uppercase', async () => {
      const invalidData = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'test@1234'
        }
      };

      await expect(RegisterSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject password without lowercase', async () => {
      const invalidData = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'TEST@1234'
        }
      };

      await expect(RegisterSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject password without number', async () => {
      const invalidData = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test@abcd'
        }
      };

      await expect(RegisterSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject password without special character', async () => {
      const invalidData = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test1234'
        }
      };

      await expect(RegisterSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject password shorter than 8 characters', async () => {
      const invalidData = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Te@1'
        }
      };

      await expect(RegisterSchema.parseAsync(invalidData)).rejects.toThrow();
    });
  });

  describe('LoginSchema', () => {
    it('should validate valid login data', async () => {
      const validData = {
        body: {
          usernameOrEmail: 'testuser',
          password: 'password123'
        }
      };

      const result = await LoginSchema.parseAsync(validData);
      expect(result.body.usernameOrEmail).toBe('testuser');
    });

    it('should accept email as usernameOrEmail', async () => {
      const validData = {
        body: {
          usernameOrEmail: 'test@example.com',
          password: 'password123'
        }
      };

      const result = await LoginSchema.parseAsync(validData);
      expect(result.body.usernameOrEmail).toBe('test@example.com');
    });

    it('should reject empty usernameOrEmail', async () => {
      const invalidData = {
        body: {
          usernameOrEmail: '',
          password: 'password123'
        }
      };

      await expect(LoginSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject empty password', async () => {
      const invalidData = {
        body: {
          usernameOrEmail: 'testuser',
          password: ''
        }
      };

      await expect(LoginSchema.parseAsync(invalidData)).rejects.toThrow();
    });
  });

  describe('RefreshTokenSchema', () => {
    it('should validate valid refresh token', async () => {
      const validData = {
        body: {
          refreshToken: 'valid-refresh-token'
        }
      };

      const result = await RefreshTokenSchema.parseAsync(validData);
      expect(result.body.refreshToken).toBe('valid-refresh-token');
    });

    it('should reject empty refresh token', async () => {
      const invalidData = {
        body: {
          refreshToken: ''
        }
      };

      await expect(RefreshTokenSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject missing refresh token', async () => {
      const invalidData = {
        body: {}
      };

      await expect(RefreshTokenSchema.parseAsync(invalidData)).rejects.toThrow();
    });
  });
});
