/**
 * OAuthTokenDaoImpl
 *
 * Implementation of OAuthTokenDao. Delegates all persistence calls to the
 * IOAuthTokenRepository (which in turn uses Prisma).
 */
import { injectable, inject } from 'inversify';
import { OAuthTokenDao } from '../interfaces/oauth-token.dao.js';
import { IOAuthTokenRepository } from '../../repositories/interfaces/oauth-token.repository.interface.js';
import { OAuthToken, CreateTokenData } from '../../models/oauth-token.model.js';
import { TOKENS } from '../../di/tokens.js';

@injectable()
export class OAuthTokenDaoImpl implements OAuthTokenDao {
  constructor(
    @inject(TOKENS.OAuthTokenRepository) private readonly tokenRepository: IOAuthTokenRepository
  ) {}

  // ── BaseDao ──────────────────────────────────────────────────────────────

  async save(data: CreateTokenData): Promise<OAuthToken> {
    return this.tokenRepository.create(data);
  }

  async update(id: number, data: Partial<OAuthToken>): Promise<OAuthToken> {
    // IOAuthTokenRepository does not expose a generic update; we simulate it
    // by using Prisma's update directly through the revoke helper when possible.
    // For a full generic update, we fall back to repository-level approach.
    // If only isRevoked is changing, use revoke() for clarity.
    if (Object.keys(data).length === 1 && data.isRevoked === true) {
      await this.tokenRepository.revoke(id);
      const token = await this.tokenRepository.getById(id);
      return token as OAuthToken;
    }
    // Extend IOAuthTokenRepository if richer update semantics are needed.
    throw new Error('OAuthTokenRepository does not support generic updates. Use domain-specific methods.');
  }

  async findById(id: number): Promise<OAuthToken | null> {
    return this.tokenRepository.getById(id);
  }

  async findAll(): Promise<OAuthToken[]> {
    // No direct "get all" on the repository; not a typical use-case for tokens.
    throw new Error('findAll() is not supported for OAuthToken. Use findActiveByUserId() instead.');
  }

  async count(): Promise<number> {
    // Not exposed by IOAuthTokenRepository; extend the repository if needed.
    throw new Error('count() is not supported for OAuthToken directly.');
  }

  async deleteById(id: number): Promise<boolean> {
    return this.tokenRepository.revoke(id);
  }

  async existsById(id: number): Promise<boolean> {
    const token = await this.tokenRepository.getById(id);
    return token !== null;
  }

  // ── OAuthTokenDao ─────────────────────────────────────────────────────────

  async findByAccessToken(accessToken: string): Promise<OAuthToken | null> {
    return this.tokenRepository.getByAccessToken(accessToken);
  }

  async findByRefreshToken(refreshToken: string): Promise<OAuthToken | null> {
    return this.tokenRepository.getByRefreshToken(refreshToken);
  }

  async findActiveByUserId(userId: number): Promise<OAuthToken[]> {
    return this.tokenRepository.getActiveForUser(userId);
  }

  async revoke(id: number): Promise<boolean> {
    return this.tokenRepository.revoke(id);
  }

  async revokeAllByUserId(userId: number): Promise<number> {
    return this.tokenRepository.revokeAllForUser(userId);
  }

  async deleteExpired(): Promise<number> {
    return this.tokenRepository.deleteExpired();
  }
}
