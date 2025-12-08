/**
 * Database Seed Script
 * Seeds the database with initial test data
 */

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  console.log('Cleaning existing data...');
  await prisma.oAuthToken.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@1234', 10);
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@arcana.cloud',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isVerified: true,
      isActive: true
    }
  });
  console.log(`✓ Created admin user: ${admin.username}`);

  // Create test users
  const userPassword = await bcrypt.hash('User@1234', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        username: 'testuser1',
        email: 'user1@arcana.cloud',
        passwordHash: userPassword,
        firstName: 'Test',
        lastName: 'User1',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        isVerified: true,
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        username: 'testuser2',
        email: 'user2@arcana.cloud',
        passwordHash: userPassword,
        firstName: 'Test',
        lastName: 'User2',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        isVerified: false,
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        username: 'inactiveuser',
        email: 'inactive@arcana.cloud',
        passwordHash: userPassword,
        firstName: 'Inactive',
        lastName: 'User',
        role: UserRole.USER,
        status: UserStatus.INACTIVE,
        isVerified: false,
        isActive: false
      }
    }),
    prisma.user.create({
      data: {
        username: 'suspendeduser',
        email: 'suspended@arcana.cloud',
        passwordHash: userPassword,
        firstName: 'Suspended',
        lastName: 'User',
        role: UserRole.USER,
        status: UserStatus.SUSPENDED,
        isVerified: true,
        isActive: false
      }
    })
  ]);

  console.log(`✓ Created ${users.length} test users`);

  // Create some tokens for test users
  const now = new Date();
  const tokens = await Promise.all([
    prisma.oAuthToken.create({
      data: {
        userId: users[0].id,
        accessToken: 'seed_access_token_1',
        refreshToken: 'seed_refresh_token_1',
        tokenType: 'Bearer',
        expiresAt: new Date(now.getTime() + 3600000), // 1 hour
        clientName: 'Web Browser',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Seed Agent'
      }
    }),
    prisma.oAuthToken.create({
      data: {
        userId: users[0].id,
        accessToken: 'seed_access_token_2',
        refreshToken: 'seed_refresh_token_2',
        tokenType: 'Bearer',
        expiresAt: new Date(now.getTime() + 3600000),
        clientName: 'Mobile App',
        ipAddress: '192.168.1.100',
        userAgent: 'ArcanaApp/1.0 iOS'
      }
    }),
    prisma.oAuthToken.create({
      data: {
        userId: users[1].id,
        accessToken: 'seed_access_token_3',
        refreshToken: 'seed_refresh_token_3',
        tokenType: 'Bearer',
        expiresAt: new Date(now.getTime() - 3600000), // Expired
        isRevoked: false
      }
    })
  ]);

  console.log(`✓ Created ${tokens.length} OAuth tokens`);

  // Summary
  const userCount = await prisma.user.count();
  const tokenCount = await prisma.oAuthToken.count();

  console.log('');
  console.log('📊 Seed Summary:');
  console.log(`   Users: ${userCount}`);
  console.log(`   OAuth Tokens: ${tokenCount}`);
  console.log('');
  console.log('🎉 Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
