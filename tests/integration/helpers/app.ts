import 'reflect-metadata';
import express, { Express } from 'express';
import { authController, userController, healthController, publicController } from '../../../src/controllers/index.js';
import { errorHandler, notFoundHandler } from '../../../src/middleware/error.middleware.js';
import { requestIdMiddleware } from '../../../src/middleware/request.middleware.js';

export function createTestApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(requestIdMiddleware);

  // Mount controllers
  app.use('/api/auth', authController);
  app.use('/api/users', userController);
  app.use('/health', healthController);
  app.use('/public', publicController);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
