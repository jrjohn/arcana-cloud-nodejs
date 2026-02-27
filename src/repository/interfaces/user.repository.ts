/**
 * UserRepository
 *
 * Domain-specific Repository interface for the User entity.
 * Extends BaseRepository with user-centric query methods.
 */
import { BaseRepository } from './base.repository.js';
import { User, CreateUserData, UserStatus } from '../../models/user.model.js';
import {
  UserFilterParams,
  PaginatedResult
} from '../../repositories/interfaces/user.repository.interface.js';

export interface UserRepository extends BaseRepository<User, number> {
  /**
   * Persist a new user. Accepts the standard CreateUserData payload plus the
   * pre-hashed password so that the Repository layer never deals with raw passwords.
   */
  save(data: CreateUserData & { passwordHash: string }): Promise<User>;

  /**
   * Partially update a user by id.
   */
  update(id: number, data: Partial<User>): Promise<User>;

  /**
   * Look up a user by their unique username. Returns null when not found.
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Look up a user by their unique e-mail address. Returns null when not found.
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Paginated listing with optional role / status filters.
   */
  findAllPaginated(params: UserFilterParams): Promise<PaginatedResult<User>>;

  /**
   * Count users matching the optional filter parameters.
   */
  count(params?: Partial<UserFilterParams>): Promise<number>;

  /**
   * Stamp the lastLoginAt timestamp for the given user id.
   */
  updateLastLogin(id: number): Promise<void>;

  /**
   * Activate or deactivate a user account.
   */
  updateStatus(id: number, status: UserStatus): Promise<User>;
}
