/**
 * @deprecated Use imports from './di/index.js' instead
 *
 * This file is kept for backwards compatibility.
 * All new code should import from './di/index.js'
 */

export { container, closeContainer as closeDependencies, resolve } from './di/index.js';
export { TOKENS } from './di/tokens.js';

/**
 * @deprecated Container is now auto-initialized. This function is a no-op.
 */
export function initializeDependencies(): void {
  // No-op: Container is automatically initialized when imported
  // Kept for backwards compatibility
}
