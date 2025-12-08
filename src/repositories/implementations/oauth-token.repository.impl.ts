import { PrismaClient } from '@prisma/client';
import { IOAuthTokenRepository } from '../interfaces/oauth-token.repository.interface.js';
import { OAuthToken, CreateTokenData } from '../../models/oauth-token.model.js';

export class OAuthTokenRepositoryImpl implements IOAuthTokenRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateTokenData): Promise<OAuthToken> {
    return this.prisma.oAuthToken.create({
      data: {
        userId: data.userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        clientName: data.clientName,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      }
    }) as unknown as OAuthToken;
  }

  async getById(id: number): Promise<OAuthToken | null> {
    return this.prisma.oAuthToken.findUnique({
      where: { id }
    }) as unknown as OAuthToken | null;
  }

  async getByAccessToken(accessToken: string): Promise<OAuthToken | null> {
    return this.prisma.oAuthToken.findFirst({
      where: { accessToken }
    }) as unknown as OAuthToken | null;
  }

  async getByRefreshToken(refreshToken: string): Promise<OAuthToken | null> {
    return this.prisma.oAuthToken.findFirst({
      where: { refreshToken }
    }) as unknown as OAuthToken | null;
  }

  async getActiveForUser(userId: number): Promise<OAuthToken[]> {
    return this.prisma.oAuthToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    }) as unknown as OAuthToken[];
  }

  async revoke(id: number): Promise<boolean> {
    await this.prisma.oAuthToken.update({
      where: { id },
      data: { isRevoked: true }
    });
    return true;
  }

  async revokeAllForUser(userId: number): Promise<number> {
    const result = await this.prisma.oAuthToken.updateMany({
      where: {
        userId,
        isRevoked: false
      },
      data: { isRevoked: true }
    });
    return result.count;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.oAuthToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
    return result.count;
  }
}
