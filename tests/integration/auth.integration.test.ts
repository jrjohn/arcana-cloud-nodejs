import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { CommunicationFactory } from '../../src/communication/factory.js';
import { container } from '../../src/container.js';
import { UserRole, UserStatus } from '../../src/models/user.model.js';
import { AuthenticationError, ConflictError } from '../../src/utils/exceptions.js';

// Mock the communication factory
vi.mock('../../src/communication/factory.js', () => ({
  CommunicationFactory: {
    getServiceCommunication: vi.fn()
  }
}));

// Mock the container for auth middleware
vi.mock('../../src/container.js', () => ({
  container: {
    get: vi.fn()
  }
}));

// Mock rate limiter
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

describe('Auth Integration Tests', () => {
  const app = createTestApp();
  let mockService: Record<string, ReturnType<typeof vi.fn>>;

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

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer'
  };

  const mockAuthResult = {
    user: mockUser,
    tokens: mockTokens
  };

  beforeEach(() => {
    mockService = {
      register: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      validateToken: vi.fn(),
      getUserById: vi.fn(),
      getUserTokens: vi.fn(),
      revokeAllTokens: vi.fn()
    };

    vi.mocked(CommunicationFactory.getServiceCommunication).mockReturnValue(mockService as any);

    // Mock container.get to return our mockService for auth middleware
    vi.mocked(container.get).mockReturnValue(mockService as any);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      mockService.register.mockResolvedValue(mockAuthResult);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'Test@1234'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('testuser');
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.message).toBe('User registered successfully');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'invalid-email',
          password: 'Test@1234'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'weak'
        });

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate username', async () => {
      mockService.register.mockRejectedValue(new ConflictError('Username already exists'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'existinguser',
          email: 'new@example.com',
          password: 'Test@1234'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe('Username already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      mockService.login.mockResolvedValue(mockAuthResult);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'testuser',
          password: 'Test@1234'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('testuser');
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });

    it('should login with email', async () => {
      mockService.login.mockResolvedValue(mockAuthResult);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'test@example.com',
          password: 'Test@1234'
        });

      expect(response.status).toBe(200);
      expect(mockService.login).toHaveBeenCalledWith(expect.objectContaining({
        usernameOrEmail: 'test@example.com',
        password: 'Test@1234'
      }));
    });

    it('should return 401 for invalid credentials', async () => {
      mockService.login.mockRejectedValue(new AuthenticationError('Invalid credentials'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('Invalid credentials');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'testuser'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);
      mockService.logout.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token', async () => {
      mockService.refreshToken.mockResolvedValue(mockTokens);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 401 for invalid refresh token', async () => {
      mockService.refreshToken.mockRejectedValue(new AuthenticationError('Invalid refresh token'));

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);
      mockService.getUserById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.username).toBe('testuser');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/tokens', () => {
    it('should return user tokens', async () => {
      const mockOAuthTokens = [
        { id: 1, accessToken: 'token1', isRevoked: false },
        { id: 2, accessToken: 'token2', isRevoked: false }
      ];

      mockService.validateToken.mockResolvedValue(mockUser);
      mockService.getUserTokens.mockResolvedValue(mockOAuthTokens);

      const response = await request(app)
        .get('/api/auth/tokens')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/auth/tokens/revoke-all', () => {
    it('should revoke all tokens', async () => {
      mockService.validateToken.mockResolvedValue(mockUser);
      mockService.revokeAllTokens.mockResolvedValue(5);

      const response = await request(app)
        .post('/api/auth/tokens/revoke-all')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.revokedCount).toBe(5);
    });
  });

  describe('Request ID', () => {
    it('should include request ID in response', async () => {
      mockService.register.mockResolvedValue(mockAuthResult);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'Test@1234'
        });

      expect(response.body.requestId).toBeDefined();
    });

    it('should use provided request ID', async () => {
      mockService.register.mockResolvedValue(mockAuthResult);

      const response = await request(app)
        .post('/api/auth/register')
        .set('X-Request-ID', 'custom-request-id')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'Test@1234'
        });

      expect(response.body.requestId).toBe('custom-request-id');
    });
  });
});
