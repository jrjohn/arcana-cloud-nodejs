/**
 * Dependency Injection Tokens (Symbols)
 *
 * These symbols provide type-safe dependency keys for InversifyJS.
 * Using symbols instead of strings prevents typos and enables IDE autocomplete.
 */

export const TOKENS = {
  // Database
  PrismaClient: Symbol.for('PrismaClient'),

  // Repositories
  UserRepository: Symbol.for('UserRepository'),
  OAuthTokenRepository: Symbol.for('OAuthTokenRepository'),

  // Services
  UserService: Symbol.for('UserService'),
  AuthService: Symbol.for('AuthService'),

  // Communication Layer
  ServiceCommunication: Symbol.for('ServiceCommunication'),
  RepositoryCommunication: Symbol.for('RepositoryCommunication'),

  // Controllers (for dependency injection)
  AuthController: Symbol.for('AuthController'),
  UserController: Symbol.for('UserController'),
} as const;

export type TokenKeys = keyof typeof TOKENS;
