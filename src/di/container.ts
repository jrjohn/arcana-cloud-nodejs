/**
 * InversifyJS Dependency Injection Container
 *
 * Configures and exports the DI container with all application dependencies.
 * Supports multiple deployment modes: Monolithic, Layered, and Microservices.
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { PrismaClient } from '@prisma/client';
import { TOKENS } from './tokens.js';

// Repositories
import { IUserRepository } from '../repositories/interfaces/user.repository.interface.js';
import { IOAuthTokenRepository } from '../repositories/interfaces/oauth-token.repository.interface.js';
import { UserRepositoryImpl } from '../repositories/implementations/user.repository.impl.js';
import { OAuthTokenRepositoryImpl } from '../repositories/implementations/oauth-token.repository.impl.js';

// DAOs
import { UserDao } from '../dao/interfaces/user.dao.js';
import { OAuthTokenDao } from '../dao/interfaces/oauth-token.dao.js';
import { UserDaoImpl } from '../dao/impl/user.dao.impl.js';
import { OAuthTokenDaoImpl } from '../dao/impl/oauth-token.dao.impl.js';

// Services
import { IUserService } from '../services/interfaces/user.service.interface.js';
import { IAuthService } from '../services/interfaces/auth.service.interface.js';
import { UserServiceImpl } from '../services/implementations/user.service.impl.js';
import { AuthServiceImpl } from '../services/implementations/auth.service.impl.js';

// Events
import { EventBus, setEventBusInstance } from '../events/event-bus.js';
import { EventStore } from '../events/event-store.js';

// Communication
import { ServiceCommunication, RepositoryCommunication, DeploymentMode, CommunicationProtocol } from '../communication/interfaces.js';
import { DirectServiceCommunication, DirectRepositoryCommunication } from '../communication/implementations/direct.impl.js';
import { HTTPServiceCommunication, HTTPRepositoryCommunication } from '../communication/implementations/http.impl.js';
import { GRPCServiceCommunication, GRPCRepositoryCommunication } from '../communication/implementations/grpc.impl.js';

/**
 * Create and configure the DI container
 */
function createContainer(): Container {
  const container = new Container({ defaultScope: 'Singleton' });

  // Database - PrismaClient
  container.bind<PrismaClient>(TOKENS.PrismaClient).toDynamicValue(() => {
    return new PrismaClient();
  }).inSingletonScope();

  // Repositories
  container.bind<IUserRepository>(TOKENS.UserRepository).to(UserRepositoryImpl).inSingletonScope();
  container.bind<IOAuthTokenRepository>(TOKENS.OAuthTokenRepository).to(OAuthTokenRepositoryImpl).inSingletonScope();

  // DAOs (depend on Repositories)
  container.bind<UserDao>(TOKENS.UserDao).to(UserDaoImpl).inSingletonScope();
  container.bind<OAuthTokenDao>(TOKENS.OAuthTokenDao).to(OAuthTokenDaoImpl).inSingletonScope();

  // Services (depend on DAOs)
  container.bind<IUserService>(TOKENS.UserService).to(UserServiceImpl).inSingletonScope();
  container.bind<IAuthService>(TOKENS.AuthService).to(AuthServiceImpl).inSingletonScope();

  // Events - EventStore and EventBus
  container.bind<EventStore>(TOKENS.EventStore).toDynamicValue((context) => {
    const prisma = context.container.get<PrismaClient>(TOKENS.PrismaClient);
    return new EventStore(prisma);
  }).inSingletonScope();

  container.bind<EventBus>(TOKENS.EventBus).toDynamicValue((context) => {
    const prisma = context.container.get<PrismaClient>(TOKENS.PrismaClient);
    const eventBus = new EventBus(prisma);
    // Set as singleton instance for backward compatibility
    setEventBusInstance(eventBus);
    return eventBus;
  }).inSingletonScope();

  // Communication Layer - Dynamic binding based on deployment mode
  bindCommunicationLayer(container);

  return container;
}

/**
 * Bind communication layer based on deployment mode and protocol
 */
function bindCommunicationLayer(container: Container): void {
  const mode = (process.env.DEPLOYMENT_MODE as DeploymentMode) || DeploymentMode.MONOLITHIC;
  const protocol = (process.env.COMMUNICATION_PROTOCOL as CommunicationProtocol) || CommunicationProtocol.GRPC;
  const layer = process.env.DEPLOYMENT_LAYER || 'monolithic';

  // Service Communication
  if (mode === DeploymentMode.MONOLITHIC) {
    container.bind<ServiceCommunication>(TOKENS.ServiceCommunication).to(DirectServiceCommunication).inSingletonScope();
  } else if (protocol === CommunicationProtocol.HTTP) {
    container.bind<ServiceCommunication>(TOKENS.ServiceCommunication).toDynamicValue(() => {
      const urls = process.env.SERVICE_URLS?.split(',') || ['http://localhost:5001'];
      return new HTTPServiceCommunication(urls);
    }).inSingletonScope();
  } else {
    container.bind<ServiceCommunication>(TOKENS.ServiceCommunication).toDynamicValue(() => {
      const urls = process.env.SERVICE_URLS?.split(',') || ['localhost:50051'];
      return new GRPCServiceCommunication(urls);
    }).inSingletonScope();
  }

  // Repository Communication
  if (mode === DeploymentMode.MONOLITHIC || layer === 'repository') {
    container.bind<RepositoryCommunication>(TOKENS.RepositoryCommunication).to(DirectRepositoryCommunication).inSingletonScope();
  } else if (protocol === CommunicationProtocol.HTTP) {
    container.bind<RepositoryCommunication>(TOKENS.RepositoryCommunication).toDynamicValue(() => {
      const urls = process.env.REPOSITORY_URLS?.split(',') || ['http://localhost:5002'];
      return new HTTPRepositoryCommunication(urls);
    }).inSingletonScope();
  } else {
    container.bind<RepositoryCommunication>(TOKENS.RepositoryCommunication).toDynamicValue(() => {
      const urls = process.env.REPOSITORY_URLS?.split(',') || ['localhost:50052'];
      return new GRPCRepositoryCommunication(urls);
    }).inSingletonScope();
  }
}

// Create the singleton container instance
export const container = createContainer();

/**
 * Get a dependency from the container (type-safe)
 */
export function resolve<T>(token: symbol): T {
  return container.get<T>(token);
}

/**
 * Close all resources managed by the container
 */
export async function closeContainer(): Promise<void> {
  if (container.isBound(TOKENS.PrismaClient)) {
    const prisma = container.get<PrismaClient>(TOKENS.PrismaClient);
    await prisma.$disconnect();
  }
}

/**
 * Reset the container (useful for testing)
 */
export function resetContainer(): Container {
  container.unbindAll();
  bindCommunicationLayer(container);

  // Re-bind core dependencies
  container.bind<PrismaClient>(TOKENS.PrismaClient).toDynamicValue(() => {
    return new PrismaClient();
  }).inSingletonScope();

  container.bind<IUserRepository>(TOKENS.UserRepository).to(UserRepositoryImpl).inSingletonScope();
  container.bind<IOAuthTokenRepository>(TOKENS.OAuthTokenRepository).to(OAuthTokenRepositoryImpl).inSingletonScope();
  container.bind<UserDao>(TOKENS.UserDao).to(UserDaoImpl).inSingletonScope();
  container.bind<OAuthTokenDao>(TOKENS.OAuthTokenDao).to(OAuthTokenDaoImpl).inSingletonScope();
  container.bind<IUserService>(TOKENS.UserService).to(UserServiceImpl).inSingletonScope();
  container.bind<IAuthService>(TOKENS.AuthService).to(AuthServiceImpl).inSingletonScope();

  return container;
}
