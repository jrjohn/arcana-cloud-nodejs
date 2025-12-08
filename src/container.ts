import { PrismaClient } from '@prisma/client';
import { UserRepositoryImpl } from './repositories/implementations/user.repository.impl.js';
import { OAuthTokenRepositoryImpl } from './repositories/implementations/oauth-token.repository.impl.js';
import { UserServiceImpl } from './services/implementations/user.service.impl.js';
import { AuthServiceImpl } from './services/implementations/auth.service.impl.js';
import { CommunicationFactory } from './communication/factory.js';

type Factory<T> = () => T;

interface Registration<T> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

class DIContainer {
  private registrations = new Map<string, Registration<unknown>>();

  registerSingleton<T>(name: string, factory: Factory<T>): void {
    this.registrations.set(name, { factory, singleton: true });
  }

  registerTransient<T>(name: string, factory: Factory<T>): void {
    this.registrations.set(name, { factory, singleton: false });
  }

  registerInstance<T>(name: string, instance: T): void {
    this.registrations.set(name, {
      factory: () => instance,
      singleton: true,
      instance
    });
  }

  get<T>(name: string): T {
    const registration = this.registrations.get(name);
    if (!registration) {
      throw new Error(`Dependency not registered: ${name}`);
    }

    if (registration.singleton) {
      if (!registration.instance) {
        registration.instance = registration.factory();
      }
      return registration.instance as T;
    }

    return registration.factory() as T;
  }

  has(name: string): boolean {
    return this.registrations.has(name);
  }

  clear(): void {
    this.registrations.clear();
  }
}

export const container = new DIContainer();

export function initializeDependencies(): void {
  const prisma = new PrismaClient();
  container.registerInstance('prisma', prisma);

  container.registerSingleton('userRepository', () =>
    new UserRepositoryImpl(container.get('prisma'))
  );
  container.registerSingleton('oauthTokenRepository', () =>
    new OAuthTokenRepositoryImpl(container.get('prisma'))
  );

  container.registerSingleton('userService', () =>
    new UserServiceImpl(container.get('userRepository'))
  );
  container.registerSingleton('authService', () =>
    new AuthServiceImpl(
      container.get('userRepository'),
      container.get('oauthTokenRepository')
    )
  );

  container.registerSingleton('serviceCommunication', () =>
    CommunicationFactory.getServiceCommunication()
  );
  container.registerSingleton('repositoryCommunication', () =>
    CommunicationFactory.getRepositoryCommunication()
  );
}

export async function closeDependencies(): Promise<void> {
  if (container.has('prisma')) {
    const prisma = container.get<PrismaClient>('prisma');
    await prisma.$disconnect();
  }
}
