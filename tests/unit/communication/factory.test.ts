import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CommunicationFactory } from '../../../src/communication/factory.js';
import { DirectServiceCommunication, DirectRepositoryCommunication } from '../../../src/communication/implementations/direct.impl.js';
import { HTTPServiceCommunication, HTTPRepositoryCommunication } from '../../../src/communication/implementations/http.impl.js';
import { GRPCServiceCommunication, GRPCRepositoryCommunication } from '../../../src/communication/implementations/grpc.impl.js';

// Mock implementations
vi.mock('../../../src/communication/implementations/direct.impl.js', () => ({
  DirectServiceCommunication: vi.fn().mockImplementation(() => ({ type: 'direct-service' })),
  DirectRepositoryCommunication: vi.fn().mockImplementation(() => ({ type: 'direct-repository' }))
}));

vi.mock('../../../src/communication/implementations/http.impl.js', () => ({
  HTTPServiceCommunication: vi.fn().mockImplementation(() => ({ type: 'http-service' })),
  HTTPRepositoryCommunication: vi.fn().mockImplementation(() => ({ type: 'http-repository' }))
}));

vi.mock('../../../src/communication/implementations/grpc.impl.js', () => ({
  GRPCServiceCommunication: vi.fn().mockImplementation(() => ({ type: 'grpc-service' })),
  GRPCRepositoryCommunication: vi.fn().mockImplementation(() => ({ type: 'grpc-repository' }))
}));

describe('CommunicationFactory', () => {
  beforeEach(() => {
    CommunicationFactory.reset();
    vi.clearAllMocks();

    // Reset environment variables
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.COMMUNICATION_PROTOCOL;
    delete process.env.DEPLOYMENT_LAYER;
    delete process.env.SERVICE_URLS;
    delete process.env.REPOSITORY_URLS;
  });

  afterEach(() => {
    CommunicationFactory.reset();
  });

  describe('getServiceCommunication', () => {
    it('should return DirectServiceCommunication for monolithic mode', () => {
      process.env.DEPLOYMENT_MODE = 'monolithic';

      const result = CommunicationFactory.getServiceCommunication();

      expect(DirectServiceCommunication).toHaveBeenCalled();
      expect(result).toEqual({ type: 'direct-service' });
    });

    it('should default to monolithic mode when not specified', () => {
      const result = CommunicationFactory.getServiceCommunication();

      expect(DirectServiceCommunication).toHaveBeenCalled();
      expect(result).toEqual({ type: 'direct-service' });
    });

    it('should return HTTPServiceCommunication for layered mode with HTTP protocol', () => {
      process.env.DEPLOYMENT_MODE = 'layered';
      process.env.COMMUNICATION_PROTOCOL = 'http';

      const result = CommunicationFactory.getServiceCommunication();

      expect(HTTPServiceCommunication).toHaveBeenCalledWith(['http://localhost:5001']);
      expect(result).toEqual({ type: 'http-service' });
    });

    it('should return GRPCServiceCommunication for layered mode with gRPC protocol', () => {
      process.env.DEPLOYMENT_MODE = 'layered';
      process.env.COMMUNICATION_PROTOCOL = 'grpc';

      const result = CommunicationFactory.getServiceCommunication();

      expect(GRPCServiceCommunication).toHaveBeenCalledWith(['localhost:50051']);
      expect(result).toEqual({ type: 'grpc-service' });
    });

    it('should return HTTPServiceCommunication for microservices mode with HTTP protocol', () => {
      process.env.DEPLOYMENT_MODE = 'microservices';
      process.env.COMMUNICATION_PROTOCOL = 'http';

      const result = CommunicationFactory.getServiceCommunication();

      expect(HTTPServiceCommunication).toHaveBeenCalled();
      expect(result).toEqual({ type: 'http-service' });
    });

    it('should return GRPCServiceCommunication for microservices mode with gRPC protocol', () => {
      process.env.DEPLOYMENT_MODE = 'microservices';
      process.env.COMMUNICATION_PROTOCOL = 'grpc';

      const result = CommunicationFactory.getServiceCommunication();

      expect(GRPCServiceCommunication).toHaveBeenCalled();
      expect(result).toEqual({ type: 'grpc-service' });
    });

    it('should use custom SERVICE_URLS when provided', () => {
      process.env.DEPLOYMENT_MODE = 'layered';
      process.env.COMMUNICATION_PROTOCOL = 'http';
      process.env.SERVICE_URLS = 'http://service1:5001,http://service2:5001';

      CommunicationFactory.getServiceCommunication();

      expect(HTTPServiceCommunication).toHaveBeenCalledWith(['http://service1:5001', 'http://service2:5001']);
    });

    it('should cache service communication instance', () => {
      const first = CommunicationFactory.getServiceCommunication();
      const second = CommunicationFactory.getServiceCommunication();

      expect(first).toBe(second);
      expect(DirectServiceCommunication).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRepositoryCommunication', () => {
    it('should return DirectRepositoryCommunication for monolithic mode', () => {
      process.env.DEPLOYMENT_MODE = 'monolithic';

      const result = CommunicationFactory.getRepositoryCommunication();

      expect(DirectRepositoryCommunication).toHaveBeenCalled();
      expect(result).toEqual({ type: 'direct-repository' });
    });

    it('should return DirectRepositoryCommunication for repository layer', () => {
      process.env.DEPLOYMENT_MODE = 'layered';
      process.env.DEPLOYMENT_LAYER = 'repository';

      const result = CommunicationFactory.getRepositoryCommunication();

      expect(DirectRepositoryCommunication).toHaveBeenCalled();
      expect(result).toEqual({ type: 'direct-repository' });
    });

    it('should return HTTPRepositoryCommunication for layered mode with HTTP protocol', () => {
      process.env.DEPLOYMENT_MODE = 'layered';
      process.env.DEPLOYMENT_LAYER = 'service';
      process.env.COMMUNICATION_PROTOCOL = 'http';

      const result = CommunicationFactory.getRepositoryCommunication();

      expect(HTTPRepositoryCommunication).toHaveBeenCalledWith(['http://localhost:5002']);
      expect(result).toEqual({ type: 'http-repository' });
    });

    it('should return GRPCRepositoryCommunication for layered mode with gRPC protocol', () => {
      process.env.DEPLOYMENT_MODE = 'layered';
      process.env.DEPLOYMENT_LAYER = 'service';
      process.env.COMMUNICATION_PROTOCOL = 'grpc';

      const result = CommunicationFactory.getRepositoryCommunication();

      expect(GRPCRepositoryCommunication).toHaveBeenCalledWith(['localhost:50052']);
      expect(result).toEqual({ type: 'grpc-repository' });
    });

    it('should use custom REPOSITORY_URLS when provided', () => {
      process.env.DEPLOYMENT_MODE = 'layered';
      process.env.DEPLOYMENT_LAYER = 'service';
      process.env.COMMUNICATION_PROTOCOL = 'http';
      process.env.REPOSITORY_URLS = 'http://repo1:5002,http://repo2:5002';

      CommunicationFactory.getRepositoryCommunication();

      expect(HTTPRepositoryCommunication).toHaveBeenCalledWith(['http://repo1:5002', 'http://repo2:5002']);
    });

    it('should cache repository communication instance', () => {
      const first = CommunicationFactory.getRepositoryCommunication();
      const second = CommunicationFactory.getRepositoryCommunication();

      expect(first).toBe(second);
      expect(DirectRepositoryCommunication).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset', () => {
    it('should clear cached instances', () => {
      CommunicationFactory.getServiceCommunication();
      CommunicationFactory.getRepositoryCommunication();

      CommunicationFactory.reset();

      CommunicationFactory.getServiceCommunication();
      CommunicationFactory.getRepositoryCommunication();

      expect(DirectServiceCommunication).toHaveBeenCalledTimes(2);
      expect(DirectRepositoryCommunication).toHaveBeenCalledTimes(2);
    });
  });
});
