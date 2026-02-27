/**
 * UserDaoImpl
 *
 * Implementation of UserDao. Delegates all persistence calls to the
 * IUserRepository (which in turn uses Prisma). The DAO layer acts as an
 * intermediary that can enrich, transform, or add cross-cutting concerns
 * without touching business logic in Services.
 */
import { injectable, inject } from 'inversify';
import { UserDao } from '../interfaces/user.dao.js';
import { IUserRepository, UserFilterParams, PaginatedResult } from '../../repositories/interfaces/user.repository.interface.js';
import { User, CreateUserData, UserStatus } from '../../models/user.model.js';
import { TOKENS } from '../../di/tokens.js';

@injectable()
export class UserDaoImpl implements UserDao {
  constructor(
    @inject(TOKENS.UserRepository) private readonly userRepository: IUserRepository
  ) {}

  // ── BaseDao ──────────────────────────────────────────────────────────────

  async save(data: CreateUserData & { passwordHash: string }): Promise<User> {
    return this.userRepository.create(data);
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    return this.userRepository.update(id, data);
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepository.getById(id);
  }

  async findAll(): Promise<User[]> {
    // Return all users (page 1, large page size) — use findAllPaginated for controlled paging.
    const result = await this.userRepository.getAll({ page: 1, perPage: 10_000 });
    return result.items;
  }

  async count(params?: Partial<UserFilterParams>): Promise<number> {
    return this.userRepository.getCount(params);
  }

  async deleteById(id: number): Promise<boolean> {
    return this.userRepository.delete(id);
  }

  async existsById(id: number): Promise<boolean> {
    const user = await this.userRepository.getById(id);
    return user !== null;
  }

  // ── UserDao ───────────────────────────────────────────────────────────────

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.getByUsername(username);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.getByEmail(email);
  }

  async findAllPaginated(params: UserFilterParams): Promise<PaginatedResult<User>> {
    return this.userRepository.getAll(params);
  }

  async updateLastLogin(id: number): Promise<void> {
    return this.userRepository.updateLastLogin(id);
  }

  async updateStatus(id: number, status: UserStatus): Promise<User> {
    return this.userRepository.update(id, { status });
  }
}
