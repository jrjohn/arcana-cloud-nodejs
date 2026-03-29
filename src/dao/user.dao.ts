/**
 * UserDao — DAO layer interface for user persistence.
 *
 * Re-exports the persistence contract from the infrastructure interfaces.
 * The Prisma-backed implementation lives in repositories/impl/.
 */
export type {
  IUserRepository,
  PaginationParams,
  UserFilterParams,
  PaginatedResult,
} from '../repositories/user.repository.interface.js';
