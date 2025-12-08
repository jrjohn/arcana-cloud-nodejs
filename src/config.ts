import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'testing', 'production']).default('development'),

  databaseUrl: z.string(),

  redisUrl: z.string().optional(),

  jwt: z.object({
    secret: z.string().min(32),
    accessExpiresIn: z.string().default('1h'),
    accessExpiresInSeconds: z.number().default(3600),
    refreshExpiresIn: z.string().default('30d'),
    refreshExpiresInSeconds: z.number().default(2592000)
  }),

  deploymentMode: z.enum(['monolithic', 'layered', 'microservices']).default('monolithic'),
  deploymentLayer: z.enum(['monolithic', 'controller', 'service', 'repository']).default('monolithic'),
  communicationProtocol: z.enum(['direct', 'http', 'grpc']).default('grpc'),
  serviceUrls: z.array(z.string()).default(['localhost:50051']),
  repositoryUrls: z.array(z.string()).default(['localhost:50052']),

  rateLimit: z.object({
    enabled: z.boolean().default(true),
    windowMs: z.number().default(3600000),
    max: z.number().default(100)
  }),

  corsOrigins: z.array(z.string()).default(['http://localhost:3000'])
});

function loadConfig() {
  const env = process.env;

  const rawConfig = {
    port: parseInt(env.PORT || '3000'),
    host: env.HOST || '0.0.0.0',
    nodeEnv: env.NODE_ENV || 'development',
    databaseUrl: env.DATABASE_URL || 'mysql://arcana:arcana_pass@localhost:3306/arcana_cloud',
    redisUrl: env.REDIS_URL,
    jwt: {
      secret: env.JWT_SECRET || (env.NODE_ENV !== 'production' ? 'dev-secret-key-min-32-characters!' : undefined),
      accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN || '1h',
      accessExpiresInSeconds: parseInt(env.JWT_ACCESS_EXPIRES_IN_SECONDS || '3600'),
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN || '30d',
      refreshExpiresInSeconds: parseInt(env.JWT_REFRESH_EXPIRES_IN_SECONDS || '2592000')
    },
    deploymentMode: env.DEPLOYMENT_MODE || 'monolithic',
    deploymentLayer: env.DEPLOYMENT_LAYER || 'monolithic',
    communicationProtocol: env.COMMUNICATION_PROTOCOL || 'grpc',
    serviceUrls: env.SERVICE_URLS?.split(',') || ['localhost:50051'],
    repositoryUrls: env.REPOSITORY_URLS?.split(',') || ['localhost:50052'],
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED !== 'false',
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || '3600000'),
      max: parseInt(env.RATE_LIMIT_MAX || '100')
    },
    corsOrigins: env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
  };

  const result = ConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }

  if (result.data.nodeEnv === 'production') {
    if (!env.JWT_SECRET) {
      console.error('JWT_SECRET must be set in production');
      process.exit(1);
    }
    if (result.data.jwt.secret.length < 64) {
      console.error('JWT_SECRET must be at least 64 characters in production');
      process.exit(1);
    }
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof ConfigSchema>;
