import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

/**
 * Note: CommunicationFactory is now deprecated and delegates to the DI container.
 * These tests verify that the factory correctly resolves from the container.
 *
 * For more comprehensive DI tests, see tests/unit/di/container.test.ts
 */

// Mock the DI module
vi.mock('../../../src/di/index.js', () => {
  const mockServiceCommunication = { type: 'service-communication' };
  const mockRepositoryCommunication = { type: 'repository-communication' };

  return {
    resolve: vi.fn((token: symbol) => {
      if (token.description === 'ServiceCommunication') {
        return mockServiceCommunication;
      }
      if (token.description === 'RepositoryCommunication') {
        return mockRepositoryCommunication;
      }
      return null;
    }),
    TOKENS: {
      ServiceCommunication: Symbol.for('ServiceCommunication'),
      RepositoryCommunication: Symbol.for('RepositoryCommunication')
    }
  };
});

// Import after mocking
import { CommunicationFactory } from '../../../src/communication/factory.js';
import { resolve } from '../../../src/di/index.js';

describe('CommunicationFactory (Deprecated - uses DI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    CommunicationFactory.reset();
  });

  describe('getServiceCommunication', () => {
    it('should resolve ServiceCommunication from DI container', () => {
      const result = CommunicationFactory.getServiceCommunication();

      expect(resolve).toHaveBeenCalled();
      expect(result).toEqual({ type: 'service-communication' });
    });

    it('should return the same instance on multiple calls (via DI singleton)', () => {
      const first = CommunicationFactory.getServiceCommunication();
      const second = CommunicationFactory.getServiceCommunication();

      expect(first).toEqual(second);
    });
  });

  describe('getRepositoryCommunication', () => {
    it('should resolve RepositoryCommunication from DI container', () => {
      const result = CommunicationFactory.getRepositoryCommunication();

      expect(resolve).toHaveBeenCalled();
      expect(result).toEqual({ type: 'repository-communication' });
    });

    it('should return the same instance on multiple calls (via DI singleton)', () => {
      const first = CommunicationFactory.getRepositoryCommunication();
      const second = CommunicationFactory.getRepositoryCommunication();

      expect(first).toEqual(second);
    });
  });

  describe('reset', () => {
    it('should be a no-op (container manages lifecycle)', () => {
      // reset() is now a no-op, but should not throw
      expect(() => CommunicationFactory.reset()).not.toThrow();
    });
  });
});
