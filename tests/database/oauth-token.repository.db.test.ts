/**
 * OAuth Token Repository Database Integration Tests
 * Tests against real MySQL database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma, cleanDatabase, testData } from './setup.js';

describe('OAuth Token Repository - Database Integration', () => {
  let testUser: { id: number };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase();
    // Create a test user for token tests
    testUser = await prisma.user.create({
      data: testData.createUserData()
    });
  });

  describe('Create Token', () => {
    it('should create a new OAuth token', async () => {
      const tokenData = testData.createTokenData(testUser.id);

      const token = await prisma.oAuthToken.create({
        data: tokenData
      });

      expect(token.id).toBeDefined();
      expect(token.userId).toBe(testUser.id);
      expect(token.accessToken).toBe(tokenData.accessToken);
      expect(token.refreshToken).toBe(tokenData.refreshToken);
      expect(token.tokenType).toBe('Bearer');
      expect(token.isRevoked).toBe(false);
      expect(token.expiresAt).toBeInstanceOf(Date);
    });

    it('should create token with client info', async () => {
      const tokenData = testData.createTokenData(testUser.id, {
        clientName: 'Test Client',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser'
      });

      const token = await prisma.oAuthToken.create({
        data: tokenData
      });

      expect(token.clientName).toBe('Test Client');
      expect(token.ipAddress).toBe('192.168.1.1');
      expect(token.userAgent).toBe('Mozilla/5.0 Test Browser');
    });

    it('should enforce foreign key constraint for userId', async () => {
      await expect(
        prisma.oAuthToken.create({
          data: testData.createTokenData(99999) // Non-existent user
        })
      ).rejects.toThrow();
    });
  });

  describe('Read Token', () => {
    it('should find token by id', async () => {
      const created = await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });

      const found = await prisma.oAuthToken.findUnique({
        where: { id: created.id }
      });

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should find token by access token', async () => {
      const tokenData = testData.createTokenData(testUser.id, {
        accessToken: 'specific_access_token'
      });

      await prisma.oAuthToken.create({ data: tokenData });

      const found = await prisma.oAuthToken.findFirst({
        where: { accessToken: 'specific_access_token' }
      });

      expect(found).not.toBeNull();
      expect(found!.accessToken).toBe('specific_access_token');
    });

    it('should find token by refresh token', async () => {
      const tokenData = testData.createTokenData(testUser.id, {
        refreshToken: 'specific_refresh_token'
      });

      await prisma.oAuthToken.create({ data: tokenData });

      const found = await prisma.oAuthToken.findFirst({
        where: { refreshToken: 'specific_refresh_token' }
      });

      expect(found).not.toBeNull();
      expect(found!.refreshToken).toBe('specific_refresh_token');
    });

    it('should find all tokens for a user', async () => {
      // Create multiple tokens for the same user
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });

      const tokens = await prisma.oAuthToken.findMany({
        where: { userId: testUser.id }
      });

      expect(tokens).toHaveLength(3);
    });

    it('should find only active (non-revoked) tokens', async () => {
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { isRevoked: false })
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { isRevoked: true })
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { isRevoked: false })
      });

      const activeTokens = await prisma.oAuthToken.findMany({
        where: {
          userId: testUser.id,
          isRevoked: false
        }
      });

      expect(activeTokens).toHaveLength(2);
    });

    it('should find non-expired tokens', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000); // 1 hour later
      const pastDate = new Date(now.getTime() - 3600000); // 1 hour ago

      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { expiresAt: futureDate })
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { expiresAt: pastDate })
      });

      const validTokens = await prisma.oAuthToken.findMany({
        where: {
          userId: testUser.id,
          expiresAt: { gt: now }
        }
      });

      expect(validTokens).toHaveLength(1);
    });

    it('should include user relation', async () => {
      const token = await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });

      const found = await prisma.oAuthToken.findUnique({
        where: { id: token.id },
        include: { user: true }
      });

      expect(found!.user).toBeDefined();
      expect(found!.user.id).toBe(testUser.id);
    });
  });

  describe('Update Token', () => {
    it('should revoke a token', async () => {
      const token = await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { isRevoked: false })
      });

      const updated = await prisma.oAuthToken.update({
        where: { id: token.id },
        data: { isRevoked: true }
      });

      expect(updated.isRevoked).toBe(true);
    });

    it('should update token expiration', async () => {
      const token = await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });

      const newExpiration = new Date(Date.now() + 7200000); // 2 hours

      const updated = await prisma.oAuthToken.update({
        where: { id: token.id },
        data: { expiresAt: newExpiration }
      });

      expect(updated.expiresAt.getTime()).toBe(newExpiration.getTime());
    });
  });

  describe('Delete Token', () => {
    it('should delete a specific token', async () => {
      const token = await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });

      await prisma.oAuthToken.delete({
        where: { id: token.id }
      });

      const found = await prisma.oAuthToken.findUnique({
        where: { id: token.id }
      });

      expect(found).toBeNull();
    });

    it('should delete all tokens for a user', async () => {
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });

      const deleteResult = await prisma.oAuthToken.deleteMany({
        where: { userId: testUser.id }
      });

      expect(deleteResult.count).toBe(3);

      const remaining = await prisma.oAuthToken.count({
        where: { userId: testUser.id }
      });

      expect(remaining).toBe(0);
    });

    it('should delete expired tokens', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 3600000);
      const pastDate = new Date(now.getTime() - 3600000);

      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { expiresAt: futureDate })
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { expiresAt: pastDate })
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { expiresAt: pastDate })
      });

      const deleteResult = await prisma.oAuthToken.deleteMany({
        where: { expiresAt: { lt: now } }
      });

      expect(deleteResult.count).toBe(2);
    });
  });

  describe('Revoke All User Tokens', () => {
    it('should revoke all tokens for a user', async () => {
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { isRevoked: false })
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { isRevoked: false })
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { isRevoked: false })
      });

      const updateResult = await prisma.oAuthToken.updateMany({
        where: { userId: testUser.id },
        data: { isRevoked: true }
      });

      expect(updateResult.count).toBe(3);

      const activeTokens = await prisma.oAuthToken.count({
        where: {
          userId: testUser.id,
          isRevoked: false
        }
      });

      expect(activeTokens).toBe(0);
    });

    it('should not affect other users tokens', async () => {
      const otherUser = await prisma.user.create({
        data: testData.createUserData()
      });

      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(otherUser.id)
      });

      await prisma.oAuthToken.updateMany({
        where: { userId: testUser.id },
        data: { isRevoked: true }
      });

      const otherUserTokens = await prisma.oAuthToken.findMany({
        where: {
          userId: otherUser.id,
          isRevoked: false
        }
      });

      expect(otherUserTokens).toHaveLength(1);
    });
  });

  describe('Token Count', () => {
    it('should count all tokens for a user', async () => {
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id)
      });

      const count = await prisma.oAuthToken.count({
        where: { userId: testUser.id }
      });

      expect(count).toBe(2);
    });

    it('should count active tokens only', async () => {
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { isRevoked: false })
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { isRevoked: true })
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(testUser.id, { isRevoked: false })
      });

      const activeCount = await prisma.oAuthToken.count({
        where: {
          userId: testUser.id,
          isRevoked: false
        }
      });

      expect(activeCount).toBe(2);
    });
  });
});
