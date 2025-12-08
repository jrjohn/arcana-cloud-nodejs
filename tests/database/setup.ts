/**
 * Database Integration Test Setup
 * Connects to real MySQL database for testing
 */

import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, beforeEach } from 'vitest';

// Create a dedicated Prisma client for tests
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://arcana_test:arcana_test_pass@localhost:3307/arcana_test'
    }
  },
  log: process.env.DEBUG_PRISMA ? ['query', 'info', 'warn', 'error'] : ['error']
});

/**
 * Clean all tables before each test
 */
export async function cleanDatabase(): Promise<void> {
  // Delete in order to respect foreign key constraints
  await prisma.oAuthToken.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Setup hooks for database tests
 */
export function setupDatabaseTests(): void {
  beforeAll(async () => {
    // Connect to database
    await prisma.$connect();
    console.log('✓ Connected to test database');
  });

  afterAll(async () => {
    // Clean up and disconnect
    await cleanDatabase();
    await prisma.$disconnect();
    console.log('✓ Disconnected from test database');
  });

  beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase();
  });
}

/**
 * Generate unique ID for test data
 */
let uniqueCounter = 0;
function uniqueId(): string {
  uniqueCounter++;
  return `${Date.now()}_${uniqueCounter}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Test data factories
 */
export const testData = {
  createUserData: (overrides: Record<string, unknown> = {}) => ({
    username: overrides.username || `testuser_${uniqueId()}`,
    email: overrides.email || `test_${uniqueId()}@example.com`,
    passwordHash: '$2b$10$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    isVerified: false,
    isActive: true,
    ...overrides
  }),

  createAdminData: (overrides: Record<string, unknown> = {}) => ({
    username: overrides.username || `admin_${uniqueId()}`,
    email: overrides.email || `admin_${uniqueId()}@example.com`,
    passwordHash: '$2b$10$hashedpassword',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN' as const,
    status: 'ACTIVE' as const,
    isVerified: true,
    isActive: true,
    ...overrides
  }),

  createTokenData: (userId: number, overrides: Record<string, unknown> = {}) => ({
    userId,
    accessToken: overrides.accessToken || `access_token_${uniqueId()}`,
    refreshToken: overrides.refreshToken || `refresh_token_${uniqueId()}`,
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    isRevoked: false,
    ...overrides
  })
};

export { PrismaClient };
