/**
 * Tests for OAuthTokenRepositoryImpl (src/repository/impl/oauth-token.repository.impl.ts)
 * This layer delegates to IOAuthTokenRepository (DAO).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OAuthTokenRepositoryImpl } from '../../../src/repository/impl/oauth-token.repository.impl.js';
import { IOAuthTokenRepository } from '../../../src/repositories/oauth-token.repository.interface.js';
import { mockOAuthToken } from '../../fixtures.js';

describe('OAuthTokenRepositoryImpl (repository layer)', () => {
  let tokenDao: IOAuthTokenRepository;
  let repository: OAuthTokenRepositoryImpl;

  beforeEach(() => {
    tokenDao = {
      create: vi.fn(),
      getById: vi.fn(),
      getByAccessToken: vi.fn(),
      getByRefreshToken: vi.fn(),
      getActiveForUser: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn(),
      deleteExpired: vi.fn()
    } as unknown as IOAuthTokenRepository;

    repository = new OAuthTokenRepositoryImpl(tokenDao);
  });

  describe('save', () => {
    it('should delegate to dao.create', async () => {
      vi.mocked(tokenDao.create).mockResolvedValue(mockOAuthToken);

      const createData = {
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      };

      const result = await repository.save(createData);

      expect(tokenDao.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(mockOAuthToken);
    });
  });

  describe('update', () => {
    it('should use revoke when setting isRevoked=true', async () => {
      const revokedToken = { ...mockOAuthToken, isRevoked: true };
      vi.mocked(tokenDao.revoke).mockResolvedValue(true);
      vi.mocked(tokenDao.getById).mockResolvedValue(revokedToken);

      const result = await repository.update(1, { isRevoked: true });

      expect(tokenDao.revoke).toHaveBeenCalledWith(1);
      expect(tokenDao.getById).toHaveBeenCalledWith(1);
      expect(result.isRevoked).toBe(true);
    });

    it('should throw for unsupported generic updates', async () => {
      await expect(repository.update(1, { userAgent: 'new-agent' })).rejects.toThrow(
        'OAuthTokenDao does not support generic updates'
      );
    });

    it('should throw for multi-field updates not matching single isRevoked', async () => {
      await expect(
        repository.update(1, { isRevoked: true, userAgent: 'test' })
      ).rejects.toThrow('OAuthTokenDao does not support generic updates');
    });
  });

  describe('findById', () => {
    it('should delegate to dao.getById', async () => {
      vi.mocked(tokenDao.getById).mockResolvedValue(mockOAuthToken);

      const result = await repository.findById(1);

      expect(tokenDao.getById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockOAuthToken);
    });

    it('should return null if not found', async () => {
      vi.mocked(tokenDao.getById).mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should throw unsupported error', async () => {
      await expect(repository.findAll()).rejects.toThrow('findAll() is not supported for OAuthToken');
    });
  });

  describe('count', () => {
    it('should throw unsupported error', async () => {
      await expect(repository.count()).rejects.toThrow('count() is not supported for OAuthToken');
    });
  });

  describe('deleteById', () => {
    it('should delegate to dao.revoke', async () => {
      vi.mocked(tokenDao.revoke).mockResolvedValue(true);

      const result = await repository.deleteById(1);

      expect(tokenDao.revoke).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  describe('existsById', () => {
    it('should return true if token exists', async () => {
      vi.mocked(tokenDao.getById).mockResolvedValue(mockOAuthToken);

      const result = await repository.existsById(1);

      expect(result).toBe(true);
    });

    it('should return false if token does not exist', async () => {
      vi.mocked(tokenDao.getById).mockResolvedValue(null);

      const result = await repository.existsById(999);

      expect(result).toBe(false);
    });
  });

  describe('findByAccessToken', () => {
    it('should delegate to dao.getByAccessToken', async () => {
      vi.mocked(tokenDao.getByAccessToken).mockResolvedValue(mockOAuthToken);

      const result = await repository.findByAccessToken('access-token');

      expect(tokenDao.getByAccessToken).toHaveBeenCalledWith('access-token');
      expect(result).toEqual(mockOAuthToken);
    });

    it('should return null if not found', async () => {
      vi.mocked(tokenDao.getByAccessToken).mockResolvedValue(null);

      const result = await repository.findByAccessToken('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByRefreshToken', () => {
    it('should delegate to dao.getByRefreshToken', async () => {
      vi.mocked(tokenDao.getByRefreshToken).mockResolvedValue(mockOAuthToken);

      const result = await repository.findByRefreshToken('refresh-token');

      expect(tokenDao.getByRefreshToken).toHaveBeenCalledWith('refresh-token');
      expect(result).toEqual(mockOAuthToken);
    });

    it('should return null if not found', async () => {
      vi.mocked(tokenDao.getByRefreshToken).mockResolvedValue(null);

      const result = await repository.findByRefreshToken('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findActiveByUserId', () => {
    it('should delegate to dao.getActiveForUser', async () => {
      const tokens = [mockOAuthToken];
      vi.mocked(tokenDao.getActiveForUser).mockResolvedValue(tokens);

      const result = await repository.findActiveByUserId(1);

      expect(tokenDao.getActiveForUser).toHaveBeenCalledWith(1);
      expect(result).toEqual(tokens);
    });

    it('should return empty array if no active tokens', async () => {
      vi.mocked(tokenDao.getActiveForUser).mockResolvedValue([]);

      const result = await repository.findActiveByUserId(1);

      expect(result).toEqual([]);
    });
  });

  describe('revoke', () => {
    it('should delegate to dao.revoke', async () => {
      vi.mocked(tokenDao.revoke).mockResolvedValue(true);

      const result = await repository.revoke(1);

      expect(tokenDao.revoke).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  describe('revokeAllByUserId', () => {
    it('should delegate to dao.revokeAllForUser', async () => {
      vi.mocked(tokenDao.revokeAllForUser).mockResolvedValue(3);

      const result = await repository.revokeAllByUserId(1);

      expect(tokenDao.revokeAllForUser).toHaveBeenCalledWith(1);
      expect(result).toBe(3);
    });
  });

  describe('deleteExpired', () => {
    it('should delegate to dao.deleteExpired', async () => {
      vi.mocked(tokenDao.deleteExpired).mockResolvedValue(5);

      const result = await repository.deleteExpired();

      expect(tokenDao.deleteExpired).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });
});
