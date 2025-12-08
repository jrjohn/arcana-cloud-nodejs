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

// User handlers
export { registerUserHandlers } from './user.handler.js';

// Security handlers (sync and async)
export {
  registerSecurityHandlers,
  getSecurityMetrics,
  clearSecurityMetrics,
  getSecurityMetricsAsync,
  clearSecurityMetricsAsync
} from './security.handler.js';

// Audit handlers (sync and async)
export { registerAuditHandler } from './audit.handler.js';
export {
  queryAuditLog,
  getAuditStats,
  clearAuditLog,
  queryAuditLogAsync,
  getAuditStatsAsync,
  addToInMemoryAuditLog
} from './audit.queries.js';
