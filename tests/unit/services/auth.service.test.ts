import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthServiceImpl } from '../../../src/services/impl/auth.service.impl.js';
import { UserRepository } from '../../../src/repository/user.repository.js';
import { OAuthTokenRepository } from '../../../src/repository/oauth-token.repository.js';
import { mockUser, mockOAuthToken, mockCreateUserData, mockLoginData } from '../../fixtures.js';
import { AuthenticationError, ConflictError } from '../../../src/utils/exceptions.js';
import { UserStatus } from '../../../src/models/user.model.js';

vi.mock('bcrypt');
vi.mock('jsonwebtoken');
vi.mock('../../../src/config.js', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key-min-32-characters-for-testing!',
      accessExpiresIn: '1h',
      accessExpiresInSeconds: 3600,
      refreshExpiresIn: '7d',
      refreshExpiresInSeconds: 604800
    }
  }
}));
vi.mock('../../../src/tasks/queue.js', () => ({
  createQueue: vi.fn(),
  createWorker: vi.fn(),
  addJob: vi.fn(),
  queues: new Map()
}));
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));
vi.mock('../../../src/events/index.js', () => ({
  getEventBus: vi.fn(() => ({
    publish: vi.fn().mockResolvedValue(undefined)
  })),
  Events: {
    userLoggedIn: vi.fn(() => ({ type: 'user.logged_in', payload: {} })),
    userLoggedOut: vi.fn(() => ({ type: 'user.logged_out', payload: {} })),
    userRegistered: vi.fn(() => ({ type: 'user.registered', payload: {} })),
    passwordChanged: vi.fn(() => ({ type: 'password.changed', payload: {} })),
    allTokensRevoked: vi.fn(() => ({ type: 'tokens.revoked', payload: {} }))
  }
}));

describe('AuthServiceImpl', () => {
  let service: AuthServiceImpl;
  let mockUserRepository: UserRepository;
  let mockTokenRepository: OAuthTokenRepository;

  beforeEach(() => {
    mockUserRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByUsername: vi.fn(),
      findByEmail: vi.fn(),
      update: vi.fn(),
      deleteById: vi.fn(),
      findAll: vi.fn(),
      findAllPaginated: vi.fn(),
      count: vi.fn(),
      existsById: vi.fn(),
      updateLastLogin: vi.fn(),
      updateStatus: vi.fn()
    } as unknown as UserRepository;

    mockTokenRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByAccessToken: vi.fn(),
      findByRefreshToken: vi.fn(),
      findActiveByUserId: vi.fn(),
      revoke: vi.fn(),
      revokeAllByUserId: vi.fn(),
      deleteExpired: vi.fn(),
      update: vi.fn(),
      findAll: vi.fn(),
      count: vi.fn(),
      deleteById: vi.fn(),
      existsById: vi.fn()
    } as unknown as OAuthTokenRepository;

    service = new AuthServiceImpl(mockUserRepository, mockTokenRepository);

    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(jwt.sign).mockReturnValue('mock-token' as never);
    vi.mocked(jwt.verify).mockReturnValue({
      userId: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'USER',
      tokenType: 'access',
      jti: 'mock-jti'
    } as never);
  });

  describe('login', () => {
    it('should login with username', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(mockUser);
      vi.mocked(mockTokenRepository.save).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockUserRepository.updateLastLogin).mockResolvedValue(undefined);

      const result = await service.login(mockLoginData);

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(mockLoginData.usernameOrEmail);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should login with email', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(mockTokenRepository.save).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockUserRepository.updateLastLogin).mockResolvedValue(undefined);

      const result = await service.login({
        ...mockLoginData,
        usernameOrEmail: 'test@example.com'
      });

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw AuthenticationError for invalid credentials', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);

      await expect(service.login(mockLoginData)).rejects.toThrow(AuthenticationError);
      await expect(service.login(mockLoginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw AuthenticationError for inactive user', async () => {
      const inactiveUser = { ...mockUser, status: UserStatus.INACTIVE };
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(inactiveUser);

      await expect(service.login(mockLoginData)).rejects.toThrow(AuthenticationError);
      await expect(service.login(mockLoginData)).rejects.toThrow('Account is not active');
    });

    it('should throw AuthenticationError for wrong password', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.login(mockLoginData)).rejects.toThrow(AuthenticationError);
    });

    it('should update last login time', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(mockUser);
      vi.mocked(mockTokenRepository.save).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockUserRepository.updateLastLogin).mockResolvedValue(undefined);

      await service.login(mockLoginData);

      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw AuthenticationError for suspended user', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(suspendedUser);

      await expect(service.login(mockLoginData)).rejects.toThrow(AuthenticationError);
      await expect(service.login(mockLoginData)).rejects.toThrow('Account is not active');
    });
  });

  describe('logout', () => {
    it('should revoke token on logout', async () => {
      vi.mocked(mockTokenRepository.findByAccessToken).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockTokenRepository.revoke).mockResolvedValue(true);

      const result = await service.logout('mock-access-token');

      expect(mockTokenRepository.revoke).toHaveBeenCalledWith(mockOAuthToken.id);
      expect(result).toBe(true);
    });

    it('should return true if token not found', async () => {
      vi.mocked(mockTokenRepository.findByAccessToken).mockResolvedValue(null);

      const result = await service.logout('nonexistent-token');

      expect(result).toBe(true);
      expect(mockTokenRepository.revoke).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens', async () => {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 1,
        tokenType: 'refresh',
        jti: 'mock-jti'
      } as never);
      vi.mocked(mockTokenRepository.findByRefreshToken).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockTokenRepository.save).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockTokenRepository.revoke).mockResolvedValue(true);

      const result = await service.refreshToken('mock-refresh-token');

      expect(mockTokenRepository.revoke).toHaveBeenCalledWith(mockOAuthToken.id);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw AuthenticationError for invalid refresh token', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for wrong token type', async () => {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 1,
        tokenType: 'access', // wrong type
        jti: 'mock-jti'
      } as never);

      await expect(service.refreshToken('mock-access-token')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for revoked token', async () => {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 1,
        tokenType: 'refresh',
        jti: 'mock-jti'
      } as never);
      vi.mocked(mockTokenRepository.findByRefreshToken).mockResolvedValue({
        ...mockOAuthToken,
        isRevoked: true
      });

      await expect(service.refreshToken('mock-refresh-token')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for null stored token', async () => {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 1,
        tokenType: 'refresh',
        jti: 'mock-jti'
      } as never);
      vi.mocked(mockTokenRepository.findByRefreshToken).mockResolvedValue(null);

      await expect(service.refreshToken('mock-refresh-token')).rejects.toThrow(AuthenticationError);
      await expect(service.refreshToken('mock-refresh-token')).rejects.toThrow('Token has been revoked');
    });

    it('should throw AuthenticationError if user not found after refresh', async () => {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 999,
        tokenType: 'refresh',
        jti: 'mock-jti'
      } as never);
      vi.mocked(mockTokenRepository.findByRefreshToken).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(service.refreshToken('mock-refresh-token')).rejects.toThrow(AuthenticationError);
      await expect(service.refreshToken('mock-refresh-token')).rejects.toThrow('User not found or inactive');
    });

    it('should throw AuthenticationError if user is inactive after refresh', async () => {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 1,
        tokenType: 'refresh',
        jti: 'mock-jti'
      } as never);
      vi.mocked(mockTokenRepository.findByRefreshToken).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockUserRepository.findById).mockResolvedValue({ ...mockUser, status: UserStatus.INACTIVE });

      await expect(service.refreshToken('mock-refresh-token')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('validateToken', () => {
    it('should validate access token', async () => {
      vi.mocked(mockTokenRepository.findByAccessToken).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);

      const result = await service.validateToken('mock-access-token');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe(mockUser.id);
    });

    it('should throw AuthenticationError for invalid token', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.validateToken('invalid-token')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for revoked token', async () => {
      vi.mocked(mockTokenRepository.findByAccessToken).mockResolvedValue({
        ...mockOAuthToken,
        isRevoked: true
      });

      await expect(service.validateToken('mock-access-token')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when token type is not access', async () => {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 1,
        tokenType: 'refresh',
        jti: 'mock-jti'
      } as never);

      await expect(service.validateToken('mock-refresh-token')).rejects.toThrow(AuthenticationError);
      await expect(service.validateToken('mock-refresh-token')).rejects.toThrow('Invalid token type');
    });

    it('should throw AuthenticationError when user not found', async () => {
      vi.mocked(mockTokenRepository.findByAccessToken).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(service.validateToken('mock-access-token')).rejects.toThrow(AuthenticationError);
      await expect(service.validateToken('mock-access-token')).rejects.toThrow('User not found');
    });
  });

  describe('register', () => {
    it('should register new user', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(mockUserRepository.save).mockResolvedValue(mockUser);
      vi.mocked(mockTokenRepository.save).mockResolvedValue(mockOAuthToken);

      const result = await service.register(mockCreateUserData);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should throw ConflictError if username exists', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(mockUser);

      await expect(service.register(mockCreateUserData)).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError if email exists', async () => {
      vi.mocked(mockUserRepository.findByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUser);

      await expect(service.register(mockCreateUserData)).rejects.toThrow(ConflictError);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await service.verifyPassword(mockUser, 'correctPassword');

      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await service.verifyPassword(mockUser, 'wrongPassword');

      expect(result).toBe(false);
    });
  });

  describe('revokeAllTokens', () => {
    it('should revoke all tokens for user', async () => {
      vi.mocked(mockTokenRepository.revokeAllByUserId).mockResolvedValue(5);

      const result = await service.revokeAllTokens(1);

      expect(mockTokenRepository.revokeAllByUserId).toHaveBeenCalledWith(1);
      expect(result).toBe(5);
    });

    it('should not publish event when no tokens revoked', async () => {
      vi.mocked(mockTokenRepository.revokeAllByUserId).mockResolvedValue(0);

      const result = await service.revokeAllTokens(1);

      expect(result).toBe(0);
    });
  });

  describe('getUserTokens', () => {
    it('should return active tokens for user', async () => {
      const tokens = [mockOAuthToken];
      vi.mocked(mockTokenRepository.findActiveByUserId).mockResolvedValue(tokens);

      const result = await service.getUserTokens(1);

      expect(mockTokenRepository.findActiveByUserId).toHaveBeenCalledWith(1);
      expect(result).toEqual(tokens);
    });
  });
});
