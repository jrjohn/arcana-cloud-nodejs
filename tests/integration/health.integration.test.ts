import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';

// Mock the DI module
vi.mock('../../src/di/index.js', () => ({
  resolve: vi.fn(() => ({})),
  TOKENS: {
    ServiceCommunication: Symbol('ServiceCommunication'),
    AuthService: Symbol('AuthService'),
    UserService: Symbol('UserService'),
    UserRepository: Symbol('UserRepository'),
    OAuthTokenRepository: Symbol('OAuthTokenRepository'),
    PrismaClient: Symbol('PrismaClient'),
    RepositoryCommunication: Symbol('RepositoryCommunication')
  },
  container: {
    get: vi.fn(() => ({}))
  },
  closeContainer: vi.fn(),
  resetContainer: vi.fn()
}));

// Mock rate limiter
vi.mock('../../src/middleware/rate-limit.middleware.js', () => ({
  authRateLimiter: (req: any, res: any, next: any) => next(),
  apiRateLimiter: (req: any, res: any, next: any) => next(),
  createRateLimiter: () => (req: any, res: any, next: any) => next()
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../src/config.js', () => ({
  config: {
    nodeEnv: 'testing',
    deploymentMode: 'monolithic',
    jwt: {
      secret: 'test-secret'
    }
  }
}));

describe('Health Integration Tests', () => {
  const app = createTestApp();

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.memory).toBeDefined();
    });

    it('should include memory stats', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.body.memory.heapUsed).toBeDefined();
      expect(response.body.memory.heapTotal).toBeDefined();
      expect(response.body.memory.rss).toBeDefined();
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});

describe('Public Integration Tests', () => {
  const app = createTestApp();

  describe('GET /public/info', () => {
    it('should return API info', async () => {
      const response = await request(app)
        .get('/public/info');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Arcana Cloud API');
      expect(response.body.version).toBeDefined();
      expect(response.body.environment).toBe('testing');
      expect(response.body.deploymentMode).toBe('monolithic');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /public/version', () => {
    it('should return version info', async () => {
      const response = await request(app)
        .get('/public/version');

      expect(response.status).toBe(200);
      expect(response.body.version).toBeDefined();
      expect(response.body.node).toBeDefined();
      expect(response.body.platform).toBeDefined();
      expect(response.body.arch).toBeDefined();
    });

    it('should include Node.js version', async () => {
      const response = await request(app)
        .get('/public/version');

      expect(response.body.node).toBe(process.version);
    });
  });
});

describe('Not Found Handler', () => {
  const app = createTestApp();

  it('should return 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/api/unknown/route');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Resource not found');
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 404 for unknown POST routes', async () => {
    const response = await request(app)
      .post('/api/unknown')
      .send({ data: 'test' });

    expect(response.status).toBe(404);
  });

  it('should include request ID in 404 response', async () => {
    const response = await request(app)
      .get('/api/unknown')
      .set('X-Request-ID', 'custom-id');

    expect(response.body.requestId).toBe('custom-id');
  });
});

describe('Request ID Middleware', () => {
  const app = createTestApp();

  it('should generate request ID if not provided', async () => {
    const response = await request(app)
      .get('/health');

    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('should use provided request ID', async () => {
    const response = await request(app)
      .get('/health')
      .set('X-Request-ID', 'my-custom-id');

    expect(response.headers['x-request-id']).toBe('my-custom-id');
  });
});

describe('Error Handler', () => {
  const app = createTestApp();

  it('should return JSON for errors', async () => {
    const response = await request(app)
      .get('/api/nonexistent');

    expect(response.headers['content-type']).toMatch(/json/);
  });

  it('should include error structure', async () => {
    const response = await request(app)
      .get('/api/nonexistent');

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('message');
    expect(response.body.error).toHaveProperty('code');
    expect(response.body).toHaveProperty('timestamp');
  });
});
