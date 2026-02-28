import { describe, it, expect, beforeEach } from 'vitest';
import { OAuthTokenRepositoryImpl } from '../../../src/repositories/impl/oauth-token.repository.impl.js';
import { mockPrisma, mockPrismaOAuthToken, resetPrismaMocks } from '../../mocks/prisma.mock.js';
import { mockOAuthToken } from '../../fixtures.js';

describe('OAuthTokenRepositoryImpl', () => {
  let repository: OAuthTokenRepositoryImpl;

  beforeEach(() => {
    resetPrismaMocks();
    repository = new OAuthTokenRepositoryImpl(mockPrisma);
  });

  describe('create', () => {
    it('should create a new token', async () => {
      const createData = {
        userId: 1,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      };

      mockPrismaOAuthToken.create.mockResolvedValue({ ...mockOAuthToken, ...createData });

      const result = await repository.create(createData);

      expect(mockPrismaOAuthToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: createData.userId,
          accessToken: createData.accessToken,
          refreshToken: createData.refreshToken
        })
      });
      expect(result.accessToken).toBe(createData.accessToken);
    });
  });

  describe('getById', () => {
    it('should return token by id', async () => {
      mockPrismaOAuthToken.findUnique.mockResolvedValue(mockOAuthToken);

      const result = await repository.getById(1);

      expect(mockPrismaOAuthToken.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(result).toEqual(mockOAuthToken);
    });

    it('should return null if token not found', async () => {
      mockPrismaOAuthToken.findUnique.mockResolvedValue(null);

      const result = await repository.getById(999);

      expect(result).toBeNull();
    });
  });

  describe('getByAccessToken', () => {
    it('should return token by access token', async () => {
      mockPrismaOAuthToken.findFirst.mockResolvedValue(mockOAuthToken);

      const result = await repository.getByAccessToken('mock-access-token');

      expect(mockPrismaOAuthToken.findFirst).toHaveBeenCalledWith({
        where: { accessToken: 'mock-access-token' }
      });
      expect(result).toEqual(mockOAuthToken);
    });

    it('should return null if token not found', async () => {
      mockPrismaOAuthToken.findFirst.mockResolvedValue(null);

      const result = await repository.getByAccessToken('nonexistent-token');

      expect(result).toBeNull();
    });
  });

  describe('getByRefreshToken', () => {
    it('should return token by refresh token', async () => {
      mockPrismaOAuthToken.findFirst.mockResolvedValue(mockOAuthToken);

      const result = await repository.getByRefreshToken('mock-refresh-token');

      expect(mockPrismaOAuthToken.findFirst).toHaveBeenCalledWith({
        where: { refreshToken: 'mock-refresh-token' }
      });
      expect(result).toEqual(mockOAuthToken);
    });
  });

  describe('getActiveForUser', () => {
    it('should return active tokens for user', async () => {
      const tokens = [mockOAuthToken, { ...mockOAuthToken, id: 2 }];
      mockPrismaOAuthToken.findMany.mockResolvedValue(tokens);

      const result = await repository.getActiveForUser(1);

      expect(mockPrismaOAuthToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: 1,
          isRevoked: false,
          expiresAt: { gt: expect.any(Date) }
        },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('revoke', () => {
    it('should revoke token', async () => {
      mockPrismaOAuthToken.update.mockResolvedValue({ ...mockOAuthToken, isRevoked: true });

      const result = await repository.revoke(1);

      expect(mockPrismaOAuthToken.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isRevoked: true }
      });
      expect(result).toBe(true);
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all tokens for user', async () => {
      mockPrismaOAuthToken.updateMany.mockResolvedValue({ count: 5 });

      const result = await repository.revokeAllForUser(1);

      expect(mockPrismaOAuthToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 1,
          isRevoked: false
        },
        data: { isRevoked: true }
      });
      expect(result).toBe(5);
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired tokens', async () => {
      mockPrismaOAuthToken.deleteMany.mockResolvedValue({ count: 10 });

      const result = await repository.deleteExpired();

      expect(mockPrismaOAuthToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) }
        }
      });
      expect(result).toBe(10);
    });
  });
});
