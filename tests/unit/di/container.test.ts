import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Container } from 'inversify';
import { TOKENS } from '../../../src/di/tokens.js';

describe('DI Tokens', () => {
  it('should have unique symbols for each token', () => {
    const tokenValues = Object.values(TOKENS);
    const uniqueTokens = new Set(tokenValues.map(t => t.toString()));

    expect(uniqueTokens.size).toBe(tokenValues.length);
  });

  it('should have expected tokens defined', () => {
    expect(TOKENS.PrismaClient).toBeDefined();
    expect(TOKENS.UserRepository).toBeDefined();
    expect(TOKENS.OAuthTokenRepository).toBeDefined();
    expect(TOKENS.UserService).toBeDefined();
    expect(TOKENS.AuthService).toBeDefined();
    expect(TOKENS.ServiceCommunication).toBeDefined();
    expect(TOKENS.RepositoryCommunication).toBeDefined();
  });

  it('should have symbols with correct descriptions', () => {
    expect(TOKENS.PrismaClient.description).toBe('PrismaClient');
    expect(TOKENS.UserRepository.description).toBe('UserRepository');
    expect(TOKENS.AuthService.description).toBe('AuthService');
  });
});

describe('DI Container Structure', () => {
  let testContainer: Container;

  beforeEach(() => {
    testContainer = new Container();
  });

  afterEach(() => {
    testContainer.unbindAll();
  });

  it('should allow binding and resolving dependencies', () => {
    const mockService = { name: 'test-service' };

    testContainer.bind(TOKENS.UserService).toConstantValue(mockService);

    const resolved = testContainer.get(TOKENS.UserService);
    expect(resolved).toBe(mockService);
  });

  it('should support singleton scope', () => {
    let instanceCount = 0;

    testContainer.bind(TOKENS.UserService).toDynamicValue(() => {
      instanceCount++;
      return { id: instanceCount };
    }).inSingletonScope();

    const first = testContainer.get(TOKENS.UserService);
    const second = testContainer.get(TOKENS.UserService);

    expect(first).toBe(second);
    expect(instanceCount).toBe(1);
  });

  it('should support transient scope', () => {
    let instanceCount = 0;

    testContainer.bind(TOKENS.UserService).toDynamicValue(() => {
      instanceCount++;
      return { id: instanceCount };
    }).inTransientScope();

    const first = testContainer.get(TOKENS.UserService);
    const second = testContainer.get(TOKENS.UserService);

    expect(first).not.toBe(second);
    expect(instanceCount).toBe(2);
  });

  it('should throw when resolving unbound token', () => {
    expect(() => testContainer.get(TOKENS.AuthService)).toThrow();
  });

  it('should correctly check if token is bound', () => {
    expect(testContainer.isBound(TOKENS.UserService)).toBe(false);

    testContainer.bind(TOKENS.UserService).toConstantValue({});

    expect(testContainer.isBound(TOKENS.UserService)).toBe(true);
  });
});
