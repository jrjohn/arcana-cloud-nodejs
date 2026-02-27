/**
 * OAuthTokenRepositoryImpl
 *
 * Implementation of OAuthTokenRepository. Delegates all persistence calls to the
 * IOAuthTokenRepository DAO (which in turn uses Prisma).
 */
import { injectable, inject } from 'inversify';
import { OAuthTokenRepository } from '../interfaces/oauth-token.repository.js';
import { IOAuthTokenRepository } from '../../repositories/interfaces/oauth-token.repository.interface.js';
import { OAuthToken, CreateTokenData } from '../../models/oauth-token.model.js';
import { TOKENS } from '../../di/tokens.js';

@injectable()
export class OAuthTokenRepositoryImpl implements OAuthTokenRepository {
  constructor(
    @inject(TOKENS.OAuthTokenDao) private readonly tokenDao: IOAuthTokenRepository
  ) {}

  // ── BaseRepository ────────────────────────────────────────────────────────

  async save(data: CreateTokenData): Promise<OAuthToken> {
    return this.tokenDao.create(data);
  }

  async update(id: number, data: Partial<OAuthToken>): Promise<OAuthToken> {
    // IOAuthTokenRepository does not expose a generic update; we simulate it
    // by using Prisma's update directly through the revoke helper when possible.
    // For a full generic update, we fall back to repository-level approach.
    // If only isRevoked is changing, use revoke() for clarity.
    if (Object.keys(data).length === 1 && data.isRevoked === true) {
      await this.tokenDao.revoke(id);
      const token = await this.tokenDao.getById(id);
      return token as OAuthToken;
    }
    // Extend IOAuthTokenRepository if richer update semantics are needed.
    throw new Error('OAuthTokenDao does not support generic updates. Use domain-specific methods.');
  }

  async findById(id: number): Promise<OAuthToken | null> {
    return this.tokenDao.getById(id);
  }

  async findAll(): Promise<OAuthToken[]> {
    // No direct "get all" on the DAO; not a typical use-case for tokens.
    throw new Error('findAll() is not supported for OAuthToken. Use findActiveByUserId() instead.');
  }

  async count(): Promise<number> {
    // Not exposed by IOAuthTokenRepository; extend the DAO if needed.
    throw new Error('count() is not supported for OAuthToken directly.');
  }

  async deleteById(id: number): Promise<boolean> {
    return this.tokenDao.revoke(id);
  }

  async existsById(id: number): Promise<boolean> {
    const token = await this.tokenDao.getById(id);
    return token !== null;
  }

  // ── OAuthTokenRepository ──────────────────────────────────────────────────

  async findByAccessToken(accessToken: string): Promise<OAuthToken | null> {
    return this.tokenDao.getByAccessToken(accessToken);
  }

  async findByRefreshToken(refreshToken: string): Promise<OAuthToken | null> {
    return this.tokenDao.getByRefreshToken(refreshToken);
  }

  async findActiveByUserId(userId: number): Promise<OAuthToken[]> {
    return this.tokenDao.getActiveForUser(userId);
  }

  async revoke(id: number): Promise<boolean> {
    return this.tokenDao.revoke(id);
  }

  async revokeAllByUserId(userId: number): Promise<number> {
    return this.tokenDao.revokeAllForUser(userId);
  }

  async deleteExpired(): Promise<number> {
    return this.tokenDao.deleteExpired();
  }
}
