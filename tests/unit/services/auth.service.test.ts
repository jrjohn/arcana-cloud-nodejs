import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthServiceImpl } from '../../../src/services/impl/auth.service.impl.js';
import { IUserRepository } from '../../../src/repositories/user.repository.interface.js';
import { IOAuthTokenRepository } from '../../../src/repositories/oauth-token.repository.interface.js';
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

describe('AuthServiceImpl', () => {
  let service: AuthServiceImpl;
  let mockUserRepository: IUserRepository;
  let mockTokenRepository: IOAuthTokenRepository;

  beforeEach(() => {
    mockUserRepository = {
      create: vi.fn(),
      getById: vi.fn(),
      getByUsername: vi.fn(),
      getByEmail: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(),
      getCount: vi.fn(),
      updateLastLogin: vi.fn()
    };

    mockTokenRepository = {
      create: vi.fn(),
      getById: vi.fn(),
      getByAccessToken: vi.fn(),
      getByRefreshToken: vi.fn(),
      getActiveForUser: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn(),
      deleteExpired: vi.fn()
    };

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
      vi.mocked(mockUserRepository.getByUsername).mockResolvedValue(mockUser);
      vi.mocked(mockTokenRepository.create).mockResolvedValue(mockOAuthToken);

      const result = await service.login(mockLoginData);

      expect(mockUserRepository.getByUsername).toHaveBeenCalledWith(mockLoginData.usernameOrEmail);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should login with email', async () => {
      vi.mocked(mockUserRepository.getByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepository.getByEmail).mockResolvedValue(mockUser);
      vi.mocked(mockTokenRepository.create).mockResolvedValue(mockOAuthToken);

      const result = await service.login({
        ...mockLoginData,
        usernameOrEmail: 'test@example.com'
      });

      expect(mockUserRepository.getByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw AuthenticationError for invalid credentials', async () => {
      vi.mocked(mockUserRepository.getByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepository.getByEmail).mockResolvedValue(null);

      await expect(service.login(mockLoginData)).rejects.toThrow(AuthenticationError);
      await expect(service.login(mockLoginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw AuthenticationError for inactive user', async () => {
      const inactiveUser = { ...mockUser, status: UserStatus.INACTIVE };
      vi.mocked(mockUserRepository.getByUsername).mockResolvedValue(inactiveUser);

      await expect(service.login(mockLoginData)).rejects.toThrow(AuthenticationError);
      await expect(service.login(mockLoginData)).rejects.toThrow('Account is not active');
    });

    it('should throw AuthenticationError for wrong password', async () => {
      vi.mocked(mockUserRepository.getByUsername).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.login(mockLoginData)).rejects.toThrow(AuthenticationError);
    });

    it('should update last login time', async () => {
      vi.mocked(mockUserRepository.getByUsername).mockResolvedValue(mockUser);
      vi.mocked(mockTokenRepository.create).mockResolvedValue(mockOAuthToken);

      await service.login(mockLoginData);

      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('logout', () => {
    it('should revoke token on logout', async () => {
      vi.mocked(mockTokenRepository.getByAccessToken).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockTokenRepository.revoke).mockResolvedValue(true);

      const result = await service.logout('mock-access-token');

      expect(mockTokenRepository.revoke).toHaveBeenCalledWith(mockOAuthToken.id);
      expect(result).toBe(true);
    });

    it('should return true if token not found', async () => {
      vi.mocked(mockTokenRepository.getByAccessToken).mockResolvedValue(null);

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
      vi.mocked(mockTokenRepository.getByRefreshToken).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockUserRepository.getById).mockResolvedValue(mockUser);
      vi.mocked(mockTokenRepository.create).mockResolvedValue(mockOAuthToken);

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
      vi.mocked(mockTokenRepository.getByRefreshToken).mockResolvedValue({
        ...mockOAuthToken,
        isRevoked: true
      });

      await expect(service.refreshToken('mock-refresh-token')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('validateToken', () => {
    it('should validate access token', async () => {
      vi.mocked(mockTokenRepository.getByAccessToken).mockResolvedValue(mockOAuthToken);
      vi.mocked(mockUserRepository.getById).mockResolvedValue(mockUser);

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
      vi.mocked(mockTokenRepository.getByAccessToken).mockResolvedValue({
        ...mockOAuthToken,
        isRevoked: true
      });

      await expect(service.validateToken('mock-access-token')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('register', () => {
    it('should register new user', async () => {
      vi.mocked(mockUserRepository.getByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepository.getByEmail).mockResolvedValue(null);
      vi.mocked(mockUserRepository.create).mockResolvedValue(mockUser);
      vi.mocked(mockTokenRepository.create).mockResolvedValue(mockOAuthToken);

      const result = await service.register(mockCreateUserData);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should throw ConflictError if username exists', async () => {
      vi.mocked(mockUserRepository.getByUsername).mockResolvedValue(mockUser);

      await expect(service.register(mockCreateUserData)).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError if email exists', async () => {
      vi.mocked(mockUserRepository.getByUsername).mockResolvedValue(null);
      vi.mocked(mockUserRepository.getByEmail).mockResolvedValue(mockUser);

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
      vi.mocked(mockTokenRepository.revokeAllForUser).mockResolvedValue(5);

      const result = await service.revokeAllTokens(1);

      expect(mockTokenRepository.revokeAllForUser).toHaveBeenCalledWith(1);
      expect(result).toBe(5);
    });
  });

  describe('getUserTokens', () => {
    it('should return active tokens for user', async () => {
      const tokens = [mockOAuthToken];
      vi.mocked(mockTokenRepository.getActiveForUser).mockResolvedValue(tokens);

      const result = await service.getUserTokens(1);

      expect(mockTokenRepository.getActiveForUser).toHaveBeenCalledWith(1);
      expect(result).toEqual(tokens);
    });
  });
});
