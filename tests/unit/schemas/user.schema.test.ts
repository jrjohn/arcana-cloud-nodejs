import { describe, it, expect } from 'vitest';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ChangePasswordSchema,
  UpdateStatusSchema
} from '../../../src/schemas/user.schema.js';
import { UserRole, UserStatus } from '../../../src/models/user.model.js';

describe('User Schemas', () => {
  describe('CreateUserSchema', () => {
    it('should validate valid user creation data', async () => {
      const validData = {
        body: {
          username: 'newuser',
          email: 'new@example.com',
          password: 'Test@1234',
          firstName: 'New',
          lastName: 'User',
          phone: '+1234567890',
          role: UserRole.USER
        }
      };

      const result = await CreateUserSchema.parseAsync(validData);
      expect(result.body.username).toBe('newuser');
      expect(result.body.role).toBe(UserRole.USER);
    });

    it('should apply default role', async () => {
      const validData = {
        body: {
          username: 'newuser',
          email: 'new@example.com',
          password: 'Test@1234'
        }
      };

      const result = await CreateUserSchema.parseAsync(validData);
      expect(result.body.role).toBe(UserRole.USER);
    });

    it('should reject username longer than 50 characters', async () => {
      const invalidData = {
        body: {
          username: 'a'.repeat(51),
          email: 'new@example.com',
          password: 'Test@1234'
        }
      };

      await expect(CreateUserSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject invalid role', async () => {
      const invalidData = {
        body: {
          username: 'newuser',
          email: 'new@example.com',
          password: 'Test@1234',
          role: 'INVALID_ROLE'
        }
      };

      await expect(CreateUserSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should accept ADMIN role', async () => {
      const validData = {
        body: {
          username: 'adminuser',
          email: 'admin@example.com',
          password: 'Test@1234',
          role: UserRole.ADMIN
        }
      };

      const result = await CreateUserSchema.parseAsync(validData);
      expect(result.body.role).toBe(UserRole.ADMIN);
    });
  });

  describe('UpdateUserSchema', () => {
    it('should validate valid update data', async () => {
      const validData = {
        body: {
          firstName: 'Updated',
          lastName: 'Name',
          email: 'updated@example.com',
          phone: '+9876543210'
        }
      };

      const result = await UpdateUserSchema.parseAsync(validData);
      expect(result.body.firstName).toBe('Updated');
    });

    it('should allow partial updates', async () => {
      const validData = {
        body: {
          firstName: 'Updated'
        }
      };

      const result = await UpdateUserSchema.parseAsync(validData);
      expect(result.body.firstName).toBe('Updated');
      expect(result.body.lastName).toBeUndefined();
    });

    it('should allow empty body', async () => {
      const validData = {
        body: {}
      };

      const result = await UpdateUserSchema.parseAsync(validData);
      expect(result.body).toEqual({});
    });

    it('should reject invalid email', async () => {
      const invalidData = {
        body: {
          email: 'invalid-email'
        }
      };

      await expect(UpdateUserSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject invalid avatarUrl', async () => {
      const invalidData = {
        body: {
          avatarUrl: 'not-a-url'
        }
      };

      await expect(UpdateUserSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should accept valid avatarUrl', async () => {
      const validData = {
        body: {
          avatarUrl: 'https://example.com/avatar.jpg'
        }
      };

      const result = await UpdateUserSchema.parseAsync(validData);
      expect(result.body.avatarUrl).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('ChangePasswordSchema', () => {
    it('should validate valid password change', async () => {
      const validData = {
        body: {
          oldPassword: 'OldPass@123',
          newPassword: 'NewPass@456'
        }
      };

      const result = await ChangePasswordSchema.parseAsync(validData);
      expect(result.body.oldPassword).toBe('OldPass@123');
      expect(result.body.newPassword).toBe('NewPass@456');
    });

    it('should reject empty old password', async () => {
      const invalidData = {
        body: {
          oldPassword: '',
          newPassword: 'NewPass@456'
        }
      };

      await expect(ChangePasswordSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject weak new password', async () => {
      const invalidData = {
        body: {
          oldPassword: 'OldPass@123',
          newPassword: 'weak'
        }
      };

      await expect(ChangePasswordSchema.parseAsync(invalidData)).rejects.toThrow();
    });
  });

  describe('UpdateStatusSchema', () => {
    it('should validate ACTIVE status', async () => {
      const validData = {
        body: {
          status: UserStatus.ACTIVE
        }
      };

      const result = await UpdateStatusSchema.parseAsync(validData);
      expect(result.body.status).toBe(UserStatus.ACTIVE);
    });

    it('should validate INACTIVE status', async () => {
      const validData = {
        body: {
          status: UserStatus.INACTIVE
        }
      };

      const result = await UpdateStatusSchema.parseAsync(validData);
      expect(result.body.status).toBe(UserStatus.INACTIVE);
    });

    it('should validate SUSPENDED status', async () => {
      const validData = {
        body: {
          status: UserStatus.SUSPENDED
        }
      };

      const result = await UpdateStatusSchema.parseAsync(validData);
      expect(result.body.status).toBe(UserStatus.SUSPENDED);
    });

    it('should reject invalid status', async () => {
      const invalidData = {
        body: {
          status: 'INVALID_STATUS'
        }
      };

      await expect(UpdateStatusSchema.parseAsync(invalidData)).rejects.toThrow();
    });

    it('should reject missing status', async () => {
      const invalidData = {
        body: {}
      };

      await expect(UpdateStatusSchema.parseAsync(invalidData)).rejects.toThrow();
    });
  });
});
