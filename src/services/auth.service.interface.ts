import { User, UserPublic, CreateUserData } from '../../models/user.model.js';
import { OAuthToken, TokenPair } from '../../models/oauth-token.model.js';

export interface LoginData {
  usernameOrEmail: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: UserPublic;
  tokens: TokenPair;
}

export interface IAuthService {
  login(data: LoginData): Promise<AuthResult>;
  logout(accessToken: string): Promise<boolean>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  validateToken(accessToken: string): Promise<UserPublic>;
  register(data: CreateUserData): Promise<AuthResult>;
  verifyPassword(user: User, password: string): Promise<boolean>;
  revokeAllTokens(userId: number): Promise<number>;
  getUserTokens(userId: number): Promise<OAuthToken[]>;
}
