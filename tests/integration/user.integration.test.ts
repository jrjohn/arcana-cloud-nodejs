import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { UserRole, UserStatus } from '../../src/models/user.model.js';
import { NotFoundError, ConflictError, AuthorizationError, AuthenticationError } from '../../src/utils/exceptions.js';

// Create mock service that will be shared
const mockService = {
  getUsers: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  changePassword: vi.fn(),
  verifyUser: vi.fn(),
  updateUserStatus: vi.fn(),
  validateToken: vi.fn()
};

// Mock the DI module
vi.mock('../../src/di/index.js', () => ({
  resolve: vi.fn(() => mockService),
  TOKENS: {
    ServiceCommunication: Symbol('ServiceCommunication'),
    AuthService: Symbol('AuthService'),
    UserService: Symbol('UserService'),
    UserRepository: Symbol('UserRepository'),
    OAuthTokenRepository: Symbol('OAuthTokenRepository'),
    PrismaClient: Symbol('PrismaClient'),
    RepositoryCommunication: Symbol('RepositoryCommunication')
  },
  container: {
    get: vi.fn(() => mockService)
  },
  closeContainer: vi.fn(),
  resetContainer: vi.fn()
}));

vi.mock('../../src/middleware/rate-limit.middleware.js', () => ({
  authRateLimiter: (req: any, res: any, next: any) => next(),
  apiRateLimiter: (req: any, res: any, next: any) => next(),
  createRateLimiter: () => (req: any, res: any, next: any) => next()
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../src/config.js', () => ({
  config: {
    nodeEnv: 'testing',
    deploymentMode: 'monolithic',
    jwt: {
      secret: 'test-secret-key-min-32-characters-for-testing!',
      accessExpiresIn: '1h',
      accessExpiresInSeconds: 3600,
      refreshExpiresIn: '7d',
      refreshExpiresInSeconds: 604800
    },
    rateLimit: {
      windowMs: 60000,
      max: 100
    }
  }
}));

describe('User Integration Tests', () => {
  const app = createTestApp();

  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    avatarUrl: null,
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null
  };

  const mockAdminUser = {
    ...mockUser,
    id: 2,
    username: 'admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN
  };

  beforeEach(() => {
    // Reset all mock functions
    vi.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('should return paginated users for admin', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.getUsers.mockResolvedValue({
        items: [mockUser, mockAdminUser],
        pagination: { page: 1, perPage: 20, total: 2, totalPages: 1 }
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('should return 403 for non-admin user', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });

    it('should support pagination params', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.getUsers.mockResolvedValue({
        items: [],
        pagination: { page: 2, perPage: 10, total: 50, totalPages: 5 }
      });

      const response = await request(app)
        .get('/api/users?page=2&perPage=10')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(mockService.getUsers).toHaveBeenCalledWith(expect.objectContaining({
        page: 2,
        perPage: 10
      }));
    });

    it('should support role and status filters', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.getUsers.mockResolvedValue({
        items: [],
        pagination: { page: 1, perPage: 20, total: 0, totalPages: 0 }
      });

      await request(app)
        .get('/api/users?role=ADMIN&status=ACTIVE')
        .set('Authorization', 'Bearer admin-token');

      expect(mockService.getUsers).toHaveBeenCalledWith(expect.objectContaining({
        role: 'ADMIN',
        status: 'ACTIVE'
      }));
    });

    it('should accept large perPage values', async () => {
      // Note: perPage validation/capping is tested in middleware unit tests
      // Integration test verifies the endpoint accepts pagination params
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.getUsers.mockResolvedValue({
        items: [],
        pagination: { page: 1, perPage: 100, total: 0, totalPages: 0 }
      });

      const response = await request(app)
        .get('/api/users?perPage=500')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(mockService.getUsers).toHaveBeenCalled();
    });
  });

  describe('GET /api/users/:userId', () => {
    it('should return user for admin', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.getUserById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/1')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body.data.username).toBe('testuser');
    });

    it('should return user for own profile', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);
      mockService.getUserById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/1')
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(200);
    });

    it('should return 403 for accessing other user profile', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/999')
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.getUserById.mockRejectedValue(new NotFoundError('User not found'));

      const response = await request(app)
        .get('/api/users/999')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/users', () => {
    it('should create user for admin', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.createUser.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer admin-token')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'Test@1234'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User created successfully');
    });

    it('should return 403 for non-admin', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer user-token')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'Test@1234'
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid data', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer admin-token')
        .send({
          username: 'ab', // too short
          email: 'invalid',
          password: 'weak'
        });

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate email', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.createUser.mockRejectedValue(new ConflictError('Email already exists'));

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', 'Bearer admin-token')
        .send({
          username: 'newuser',
          email: 'existing@example.com',
          password: 'Test@1234'
        });

      expect(response.status).toBe(409);
    });
  });

  describe('PUT /api/users/:userId', () => {
    it('should update own profile', async () => {
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      mockService.validateToken.mockResolvedValue(mockUser);
      mockService.updateUser.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/1')
        .set('Authorization', 'Bearer user-token')
        .send({ firstName: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body.data.firstName).toBe('Updated');
    });

    it('should update any user for admin', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.updateUser.mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/api/users/1')
        .set('Authorization', 'Bearer admin-token')
        .send({ firstName: 'Updated' });

      expect(response.status).toBe(200);
    });

    it('should return 403 for updating other user', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/api/users/999')
        .set('Authorization', 'Bearer user-token')
        .send({ firstName: 'Updated' });

      expect(response.status).toBe(403);
    });

    it('should validate update data', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/api/users/1')
        .set('Authorization', 'Bearer user-token')
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/users/:userId', () => {
    it('should delete user for admin', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.deleteUser.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/users/1')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User deleted successfully');
    });

    it('should return 403 for non-admin', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .delete('/api/users/1')
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/users/:userId/password', () => {
    it('should change own password', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);
      mockService.changePassword.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/users/1/password')
        .set('Authorization', 'Bearer user-token')
        .send({
          oldPassword: 'OldPass@123',
          newPassword: 'NewPass@456'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password changed successfully');
    });

    it('should return 403 for changing other user password', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/api/users/999/password')
        .set('Authorization', 'Bearer user-token')
        .send({
          oldPassword: 'OldPass@123',
          newPassword: 'NewPass@456'
        });

      expect(response.status).toBe(403);
    });

    it('should return 401 for wrong old password', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);
      mockService.changePassword.mockRejectedValue(new AuthenticationError('Incorrect password'));

      const response = await request(app)
        .put('/api/users/1/password')
        .set('Authorization', 'Bearer user-token')
        .send({
          oldPassword: 'WrongPass@123',
          newPassword: 'NewPass@456'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/users/:userId/verify', () => {
    it('should verify user for admin', async () => {
      const verifiedUser = { ...mockUser, isVerified: true };
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.verifyUser.mockResolvedValue(verifiedUser);

      const response = await request(app)
        .post('/api/users/1/verify')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body.data.isVerified).toBe(true);
    });

    it('should return 403 for non-admin', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/users/1/verify')
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/users/:userId/status', () => {
    it('should update user status for admin', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      mockService.validateToken.mockResolvedValue(mockAdminUser);
      mockService.updateUserStatus.mockResolvedValue(suspendedUser);

      const response = await request(app)
        .put('/api/users/1/status')
        .set('Authorization', 'Bearer admin-token')
        .send({ status: 'SUSPENDED' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('SUSPENDED');
    });

    it('should return 403 for non-admin', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);

      const response = await request(app)
        .put('/api/users/1/status')
        .set('Authorization', 'Bearer user-token')
        .send({ status: 'SUSPENDED' });

      expect(response.status).toBe(403);
    });

    it('should validate status value', async () => {
      mockService.validateToken.mockResolvedValue(mockAdminUser);

      const response = await request(app)
        .put('/api/users/1/status')
        .set('Authorization', 'Bearer admin-token')
        .send({ status: 'INVALID_STATUS' });

      expect(response.status).toBe(400);
    });
  });
});
