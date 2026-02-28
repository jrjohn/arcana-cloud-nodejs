import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore environment
    Object.assign(process.env, originalEnv);
    vi.resetModules();
  });

  it('should load config with default values in test mode', async () => {
    process.env.NODE_ENV = 'testing';
    process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long!';

    const { config } = await import('../../src/config.js');

    expect(config).toBeDefined();
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.jwt).toBeDefined();
    expect(config.jwt.accessExpiresIn).toBe('1h');
  });

  it('should load PORT from environment', async () => {
    process.env.NODE_ENV = 'testing';
    process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long!';
    process.env.PORT = '8080';

    vi.resetModules();
    const { config } = await import('../../src/config.js');

    expect(config.port).toBe(8080);
    delete process.env.PORT;
  });

  it('should parse CORS_ORIGINS from environment', async () => {
    process.env.NODE_ENV = 'testing';
    process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long!';
    process.env.CORS_ORIGINS = 'http://localhost:3000,https://example.com';

    vi.resetModules();
    const { config } = await import('../../src/config.js');

    expect(config.corsOrigins).toContain('http://localhost:3000');
    expect(config.corsOrigins).toContain('https://example.com');

    delete process.env.CORS_ORIGINS;
  });

  it('should parse SERVICE_URLS from environment', async () => {
    process.env.NODE_ENV = 'testing';
    process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long!';
    process.env.SERVICE_URLS = 'service1:50051,service2:50051';

    vi.resetModules();
    const { config } = await import('../../src/config.js');

    expect(config.serviceUrls).toContain('service1:50051');
    expect(config.serviceUrls).toContain('service2:50051');

    delete process.env.SERVICE_URLS;
  });

  it('should set redisUrl when REDIS_URL is provided', async () => {
    process.env.NODE_ENV = 'testing';
    process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long!';
    process.env.REDIS_URL = 'redis://localhost:6379';

    vi.resetModules();
    const { config } = await import('../../src/config.js');

    expect(config.redisUrl).toBe('redis://localhost:6379');

    delete process.env.REDIS_URL;
  });

  it('should configure JWT expiry from environment', async () => {
    process.env.NODE_ENV = 'testing';
    process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long!';
    process.env.JWT_ACCESS_EXPIRES_IN = '2h';
    process.env.JWT_ACCESS_EXPIRES_IN_SECONDS = '7200';

    vi.resetModules();
    const { config } = await import('../../src/config.js');

    expect(config.jwt.accessExpiresIn).toBe('2h');
    expect(config.jwt.accessExpiresInSeconds).toBe(7200);

    delete process.env.JWT_ACCESS_EXPIRES_IN;
    delete process.env.JWT_ACCESS_EXPIRES_IN_SECONDS;
  });

  it('should configure rate limit from environment', async () => {
    process.env.NODE_ENV = 'testing';
    process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long!';
    process.env.RATE_LIMIT_MAX = '50';

    vi.resetModules();
    const { config } = await import('../../src/config.js');

    expect(config.rateLimit.max).toBe(50);

    delete process.env.RATE_LIMIT_MAX;
  });

  it('should have rate limit disabled when RATE_LIMIT_ENABLED=false', async () => {
    process.env.NODE_ENV = 'testing';
    process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long!';
    process.env.RATE_LIMIT_ENABLED = 'false';

    vi.resetModules();
    const { config } = await import('../../src/config.js');

    expect(config.rateLimit.enabled).toBe(false);

    delete process.env.RATE_LIMIT_ENABLED;
  });
});
