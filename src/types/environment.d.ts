declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'testing' | 'production';
      PORT?: string;
      HOST?: string;
      DATABASE_URL: string;
      REDIS_URL?: string;
      JWT_SECRET: string;
      JWT_ACCESS_EXPIRES_IN?: string;
      JWT_ACCESS_EXPIRES_IN_SECONDS?: string;
      JWT_REFRESH_EXPIRES_IN?: string;
      JWT_REFRESH_EXPIRES_IN_SECONDS?: string;
      DEPLOYMENT_MODE?: 'monolithic' | 'layered' | 'microservices';
      DEPLOYMENT_LAYER?: 'monolithic' | 'controller' | 'service' | 'repository';
      COMMUNICATION_PROTOCOL?: 'direct' | 'http' | 'grpc';
      SERVICE_URLS?: string;
      REPOSITORY_URLS?: string;
      RATE_LIMIT_ENABLED?: string;
      RATE_LIMIT_WINDOW_MS?: string;
      RATE_LIMIT_MAX?: string;
      CORS_ORIGINS?: string;
      LOG_LEVEL?: string;
    }
  }
}

export {};
