export interface OAuthToken {
  id: number;
  userId: number;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: Date;
  clientName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface CreateTokenData {
  userId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  clientName?: string;
  ipAddress?: string;
  userAgent?: string;
}
