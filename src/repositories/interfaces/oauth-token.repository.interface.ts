import { OAuthToken, CreateTokenData } from '../../models/oauth-token.model.js';

export interface IOAuthTokenRepository {
  create(data: CreateTokenData): Promise<OAuthToken>;
  getById(id: number): Promise<OAuthToken | null>;
  getByAccessToken(accessToken: string): Promise<OAuthToken | null>;
  getByRefreshToken(refreshToken: string): Promise<OAuthToken | null>;
  getActiveForUser(userId: number): Promise<OAuthToken[]>;
  revoke(id: number): Promise<boolean>;
  revokeAllForUser(userId: number): Promise<number>;
  deleteExpired(): Promise<number>;
}
