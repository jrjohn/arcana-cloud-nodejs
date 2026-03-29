/**
 * OAuthTokenDao — DAO layer interface for token persistence.
 *
 * Re-exports the persistence contract from the infrastructure interfaces.
 * The Prisma-backed implementation lives in repositories/impl/.
 */
export type { IOAuthTokenRepository } from '../repositories/oauth-token.repository.interface.js';
