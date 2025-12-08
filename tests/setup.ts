import { beforeAll, afterAll, vi } from 'vitest';

// Set test environment
beforeAll(async () => {
  process.env.NODE_ENV = 'testing';
  process.env.DATABASE_URL = 'mysql://arcana:arcana_pass@localhost:3306/arcana_cloud_test';
  process.env.JWT_SECRET = 'test-secret-key-min-32-characters-for-testing!';
  process.env.JWT_ACCESS_EXPIRES_IN = '1h';
  process.env.JWT_ACCESS_EXPIRES_IN_SECONDS = '3600';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.JWT_REFRESH_EXPIRES_IN_SECONDS = '604800';
  process.env.DEPLOYMENT_MODE = 'monolithic';
  process.env.RATE_LIMIT_ENABLED = 'false';
});

afterAll(async () => {
  vi.clearAllMocks();
});

// Global test timeout
vi.setConfig({ testTimeout: 30000 });
