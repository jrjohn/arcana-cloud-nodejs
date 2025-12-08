/**
 * User Repository Database Integration Tests
 * Tests against real MySQL database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma, cleanDatabase, testData } from './setup.js';
import { UserRole, UserStatus } from '@prisma/client';

describe('User Repository - Database Integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('Create User', () => {
    it('should create a new user in database', async () => {
      const userData = testData.createUserData();

      const user = await prisma.user.create({
        data: userData
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(UserRole.USER);
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should enforce unique username constraint', async () => {
      const userData = testData.createUserData({ username: 'uniqueuser' });

      await prisma.user.create({ data: userData });

      await expect(
        prisma.user.create({
          data: { ...testData.createUserData(), username: 'uniqueuser' }
        })
      ).rejects.toThrow();
    });

    it('should enforce unique email constraint', async () => {
      const userData = testData.createUserData({ email: 'unique@example.com' });

      await prisma.user.create({ data: userData });

      await expect(
        prisma.user.create({
          data: { ...testData.createUserData(), email: 'unique@example.com' }
        })
      ).rejects.toThrow();
    });

    it('should create admin user with correct role', async () => {
      const adminData = testData.createAdminData();

      const admin = await prisma.user.create({
        data: adminData
      });

      expect(admin.role).toBe(UserRole.ADMIN);
      expect(admin.isVerified).toBe(true);
    });
  });

  describe('Read User', () => {
    it('should find user by id', async () => {
      const created = await prisma.user.create({
        data: testData.createUserData()
      });

      const found = await prisma.user.findUnique({
        where: { id: created.id }
      });

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.username).toBe(created.username);
    });

    it('should find user by username', async () => {
      const created = await prisma.user.create({
        data: testData.createUserData({ username: 'findme' })
      });

      const found = await prisma.user.findUnique({
        where: { username: 'findme' }
      });

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should find user by email', async () => {
      const created = await prisma.user.create({
        data: testData.createUserData({ email: 'findme@example.com' })
      });

      const found = await prisma.user.findUnique({
        where: { email: 'findme@example.com' }
      });

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent user', async () => {
      const found = await prisma.user.findUnique({
        where: { id: 99999 }
      });

      expect(found).toBeNull();
    });

    it('should find users with pagination', async () => {
      // Create 15 users
      for (let i = 0; i < 15; i++) {
        await prisma.user.create({
          data: testData.createUserData({ username: `user${i}` })
        });
      }

      const page1 = await prisma.user.findMany({
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'asc' }
      });

      const page2 = await prisma.user.findMany({
        take: 10,
        skip: 10,
        orderBy: { createdAt: 'asc' }
      });

      expect(page1).toHaveLength(10);
      expect(page2).toHaveLength(5);
    });

    it('should filter users by role', async () => {
      await prisma.user.create({ data: testData.createUserData() });
      await prisma.user.create({ data: testData.createUserData() });
      await prisma.user.create({ data: testData.createAdminData() });

      const admins = await prisma.user.findMany({
        where: { role: UserRole.ADMIN }
      });

      const users = await prisma.user.findMany({
        where: { role: UserRole.USER }
      });

      expect(admins).toHaveLength(1);
      expect(users).toHaveLength(2);
    });

    it('should filter users by status', async () => {
      await prisma.user.create({
        data: testData.createUserData({ status: 'ACTIVE' })
      });
      await prisma.user.create({
        data: testData.createUserData({ status: 'SUSPENDED' })
      });
      await prisma.user.create({
        data: testData.createUserData({ status: 'INACTIVE' })
      });

      const activeUsers = await prisma.user.findMany({
        where: { status: UserStatus.ACTIVE }
      });

      expect(activeUsers).toHaveLength(1);
    });

    it('should count total users', async () => {
      await prisma.user.create({ data: testData.createUserData() });
      await prisma.user.create({ data: testData.createUserData() });
      await prisma.user.create({ data: testData.createUserData() });

      const count = await prisma.user.count();

      expect(count).toBe(3);
    });
  });

  describe('Update User', () => {
    it('should update user fields', async () => {
      const created = await prisma.user.create({
        data: testData.createUserData()
      });

      const updated = await prisma.user.update({
        where: { id: created.id },
        data: {
          firstName: 'Updated',
          lastName: 'Name'
        }
      });

      expect(updated.firstName).toBe('Updated');
      expect(updated.lastName).toBe('Name');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('should update user status', async () => {
      const created = await prisma.user.create({
        data: testData.createUserData({ status: 'ACTIVE' })
      });

      const updated = await prisma.user.update({
        where: { id: created.id },
        data: { status: UserStatus.SUSPENDED }
      });

      expect(updated.status).toBe(UserStatus.SUSPENDED);
    });

    it('should update user verification status', async () => {
      const created = await prisma.user.create({
        data: testData.createUserData({ isVerified: false })
      });

      const updated = await prisma.user.update({
        where: { id: created.id },
        data: { isVerified: true }
      });

      expect(updated.isVerified).toBe(true);
    });

    it('should update lastLoginAt', async () => {
      const created = await prisma.user.create({
        data: testData.createUserData()
      });

      expect(created.lastLoginAt).toBeNull();

      const loginTime = new Date();
      const updated = await prisma.user.update({
        where: { id: created.id },
        data: { lastLoginAt: loginTime }
      });

      expect(updated.lastLoginAt).toEqual(loginTime);
    });
  });

  describe('Delete User', () => {
    it('should delete user', async () => {
      const created = await prisma.user.create({
        data: testData.createUserData()
      });

      await prisma.user.delete({
        where: { id: created.id }
      });

      const found = await prisma.user.findUnique({
        where: { id: created.id }
      });

      expect(found).toBeNull();
    });

    it('should cascade delete user tokens', async () => {
      const user = await prisma.user.create({
        data: testData.createUserData()
      });

      await prisma.oAuthToken.create({
        data: testData.createTokenData(user.id)
      });
      await prisma.oAuthToken.create({
        data: testData.createTokenData(user.id)
      });

      // Verify tokens exist
      const tokensBefore = await prisma.oAuthToken.count({
        where: { userId: user.id }
      });
      expect(tokensBefore).toBe(2);

      // Delete user (should cascade)
      await prisma.user.delete({
        where: { id: user.id }
      });

      // Verify tokens are deleted
      const tokensAfter = await prisma.oAuthToken.count({
        where: { userId: user.id }
      });
      expect(tokensAfter).toBe(0);
    });
  });

  describe('Transactions', () => {
    it('should rollback on error in transaction', async () => {
      const initialCount = await prisma.user.count();

      try {
        await prisma.$transaction(async (tx) => {
          await tx.user.create({
            data: testData.createUserData({ username: 'txuser1' })
          });
          await tx.user.create({
            data: testData.createUserData({ username: 'txuser2' })
          });
          // This should fail (duplicate username)
          await tx.user.create({
            data: testData.createUserData({ username: 'txuser1' })
          });
        });
      } catch (error) {
        // Expected to fail
      }

      const finalCount = await prisma.user.count();
      expect(finalCount).toBe(initialCount); // No users created due to rollback
    });

    it('should commit all changes in successful transaction', async () => {
      const initialCount = await prisma.user.count();

      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: testData.createUserData({ username: 'txuser1' })
        });
        await tx.user.create({
          data: testData.createUserData({ username: 'txuser2' })
        });
        await tx.user.create({
          data: testData.createUserData({ username: 'txuser3' })
        });
      });

      const finalCount = await prisma.user.count();
      expect(finalCount).toBe(initialCount + 3);
    });
  });
});
