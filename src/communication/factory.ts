/**
 * @deprecated Use DI container instead.
 *
 * This factory is deprecated. Use the DI container to get communication instances:
 *
 * import { resolve, TOKENS } from './di/index.js';
 * const service = resolve<ServiceCommunication>(TOKENS.ServiceCommunication);
 */

import { ServiceCommunication, RepositoryCommunication } from './interfaces.js';
import { resolve, TOKENS } from '../di/index.js';

export class CommunicationFactory {
  /**
   * @deprecated Use resolve<ServiceCommunication>(TOKENS.ServiceCommunication) instead
   */
  static getServiceCommunication(): ServiceCommunication {
    return resolve<ServiceCommunication>(TOKENS.ServiceCommunication);
  }

  /**
   * @deprecated Use resolve<RepositoryCommunication>(TOKENS.RepositoryCommunication) instead
   */
  static getRepositoryCommunication(): RepositoryCommunication {
    return resolve<RepositoryCommunication>(TOKENS.RepositoryCommunication);
  }

  /**
   * @deprecated No longer needed with DI container
   */
  static reset(): void {
    // No-op: Container manages lifecycle now
  }
}
