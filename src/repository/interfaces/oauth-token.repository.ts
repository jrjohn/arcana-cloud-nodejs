/**
 * OAuthTokenRepository
 *
 * Domain-specific Repository interface for the OAuthToken entity.
 * Extends BaseRepository with token-lifecycle query methods.
 */
import { BaseRepository } from './base.repository.js';
import { OAuthToken, CreateTokenData } from '../../models/oauth-token.model.js';

export interface OAuthTokenRepository extends BaseRepository<OAuthToken, number> {
  /**
   * Persist a new OAuth token record.
   */
  save(data: CreateTokenData): Promise<OAuthToken>;

  /**
   * Partially update a token record by id.
   */
  update(id: number, data: Partial<OAuthToken>): Promise<OAuthToken>;

  /**
   * Look up a token by its opaque access-token string.
   * Returns null when not found.
   */
  findByAccessToken(accessToken: string): Promise<OAuthToken | null>;

  /**
   * Look up a token by its opaque refresh-token string.
   * Returns null when not found.
   */
  findByRefreshToken(refreshToken: string): Promise<OAuthToken | null>;

  /**
   * Return all non-revoked, non-expired tokens for the given user.
   */
  findActiveByUserId(userId: number): Promise<OAuthToken[]>;

  /**
   * Mark a single token as revoked. Returns true on success.
   */
  revoke(id: number): Promise<boolean>;

  /**
   * Revoke every active token belonging to a user.
   * Returns the number of tokens revoked.
   */
  revokeAllByUserId(userId: number): Promise<number>;

  /**
   * Hard-delete all tokens whose expiresAt is in the past.
   * Returns the number of records deleted.
   */
  deleteExpired(): Promise<number>;
}
