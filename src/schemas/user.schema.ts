import { z } from 'zod';
import { UserRole, UserStatus } from '../models/user.model.js';

export const CreateUserSchema = z.object({
  body: z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be at most 50 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    phone: z.string().max(20).optional(),
    role: z.nativeEnum(UserRole).optional().default(UserRole.USER)
  })
});

export const UpdateUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').optional(),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    phone: z.string().max(20).optional(),
    avatarUrl: z.string().url('Invalid URL').optional()
  })
});

export const ChangePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
  })
});

export const UpdateStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(UserStatus)
  })
});

export const PaginationSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    perPage: z.string().regex(/^\d+$/).transform(Number).default('20'),
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(UserStatus).optional()
  })
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>['body'];
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>['body'];
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>['body'];
