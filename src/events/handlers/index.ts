/**
 * Event Handlers Index
 *
 * Register all event handlers
 */

import { registerUserHandlers } from './user.handler.js';
import { registerSecurityHandlers } from './security.handler.js';
import { registerAuditHandler } from './audit.handler.js';
import { logger } from '../../utils/logger.js';

/**
 * Register all event handlers
 */
export function registerAllHandlers(): void {
  registerUserHandlers();
  registerSecurityHandlers();
  registerAuditHandler();

  logger.info('All event handlers registered');
}

export { registerUserHandlers } from './user.handler.js';
export { registerSecurityHandlers, getSecurityMetrics, clearSecurityMetrics } from './security.handler.js';
export { registerAuditHandler, queryAuditLog, getAuditStats, clearAuditLog } from './audit.handler.js';
