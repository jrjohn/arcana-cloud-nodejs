import 'reflect-metadata';
import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { closeContainer } from './di/index.js';
import { initializeTasks, shutdownTasks } from './tasks/index.js';
import { initializeEventSystem } from './events/index.js';
import { startRepositoryGRPCServer, startServiceGRPCServer } from './grpc/grpc-server.js';

async function main() {
  const app = createApp();

  // Initialize task system (if Redis configured)
  const tasksEnabled = await initializeTasks();
  if (tasksEnabled) {
    logger.info('Task system (background jobs, scheduled tasks) enabled');

    // Initialize event system (requires Redis for async events)
    await initializeEventSystem();
    logger.info('Event-driven architecture enabled');
  }

  const httpServer = app.listen(config.port, config.host, () => {
    logger.info(`HTTP server started on ${config.host}:${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Deployment mode: ${config.deploymentMode}`);
    logger.info(`Deployment layer: ${config.deploymentLayer}`);
    logger.info(`Communication protocol: ${config.communicationProtocol}`);
  });

  // Start gRPC server for layered deployments
  let grpcServer: ReturnType<typeof startRepositoryGRPCServer> | null = null;
  if (config.communicationProtocol === 'grpc' && config.deploymentMode === 'layered') {
    if (config.deploymentLayer === 'repository') {
      grpcServer = startRepositoryGRPCServer(config.grpcPort);
    } else if (config.deploymentLayer === 'service') {
      grpcServer = startServiceGRPCServer(config.grpcPort);
    }
  }

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);

    grpcServer?.forceShutdown();

    httpServer.close(async () => {
      logger.info('HTTP server closed');

      // Shutdown tasks first (let jobs complete)
      await shutdownTasks();

      await closeContainer();
      logger.info('DI Container closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Force shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

try {
  await main();
} catch (error) {
  logger.error('Failed to start server:', error);
  process.exit(1);
}
