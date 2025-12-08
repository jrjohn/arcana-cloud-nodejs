import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config.js';
import { initializeDependencies } from './container.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { requestIdMiddleware, requestLoggerMiddleware } from './middleware/request.middleware.js';
import { apiRateLimiter } from './middleware/rate-limit.middleware.js';
import authController from './controllers/auth.controller.js';
import userController from './controllers/user.controller.js';
import publicController from './controllers/public.controller.js';
import healthController from './controllers/health.controller.js';

export function createApp(): Express {
  const app = express();

  initializeDependencies();

  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  if (config.rateLimit.enabled) {
    app.use(apiRateLimiter);
  }

  app.use('/health', healthController);
  app.use('/ready', healthController);

  app.use('/api/v1/auth', authController);
  app.use('/api/v1/users', userController);
  app.use('/public', publicController);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
