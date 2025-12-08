import { DeploymentMode, CommunicationProtocol, ServiceCommunication, RepositoryCommunication } from './interfaces.js';
import { DirectServiceCommunication, DirectRepositoryCommunication } from './implementations/direct.impl.js';
import { HTTPServiceCommunication, HTTPRepositoryCommunication } from './implementations/http.impl.js';
import { GRPCServiceCommunication, GRPCRepositoryCommunication } from './implementations/grpc.impl.js';

export class CommunicationFactory {
  private static serviceInstance: ServiceCommunication | null = null;
  private static repositoryInstance: RepositoryCommunication | null = null;

  static getServiceCommunication(): ServiceCommunication {
    if (this.serviceInstance) return this.serviceInstance;

    const mode = (process.env.DEPLOYMENT_MODE as DeploymentMode) || DeploymentMode.MONOLITHIC;
    const protocol = (process.env.COMMUNICATION_PROTOCOL as CommunicationProtocol) || CommunicationProtocol.GRPC;

    switch (mode) {
      case DeploymentMode.MONOLITHIC:
        this.serviceInstance = new DirectServiceCommunication();
        break;
      case DeploymentMode.LAYERED:
      case DeploymentMode.MICROSERVICES:
        if (protocol === CommunicationProtocol.HTTP) {
          this.serviceInstance = new HTTPServiceCommunication(
            process.env.SERVICE_URLS?.split(',') || ['http://localhost:5001']
          );
        } else {
          this.serviceInstance = new GRPCServiceCommunication(
            process.env.SERVICE_URLS?.split(',') || ['localhost:50051']
          );
        }
        break;
    }

    return this.serviceInstance!;
  }

  static getRepositoryCommunication(): RepositoryCommunication {
    if (this.repositoryInstance) return this.repositoryInstance;

    const mode = (process.env.DEPLOYMENT_MODE as DeploymentMode) || DeploymentMode.MONOLITHIC;
    const protocol = (process.env.COMMUNICATION_PROTOCOL as CommunicationProtocol) || CommunicationProtocol.GRPC;
    const layer = process.env.DEPLOYMENT_LAYER || 'monolithic';

    if (mode === DeploymentMode.MONOLITHIC || layer === 'repository') {
      this.repositoryInstance = new DirectRepositoryCommunication();
    } else if (protocol === CommunicationProtocol.HTTP) {
      this.repositoryInstance = new HTTPRepositoryCommunication(
        process.env.REPOSITORY_URLS?.split(',') || ['http://localhost:5002']
      );
    } else {
      this.repositoryInstance = new GRPCRepositoryCommunication(
        process.env.REPOSITORY_URLS?.split(',') || ['localhost:50052']
      );
    }

    return this.repositoryInstance!;
  }

  static reset(): void {
    this.serviceInstance = null;
    this.repositoryInstance = null;
  }
}
