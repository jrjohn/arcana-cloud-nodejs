/**
 * UserRepositoryImpl
 *
 * Implementation of UserRepository. Delegates all persistence calls to the
 * IUserRepository DAO (which in turn uses Prisma). The Repository layer acts as an
 * intermediary that can enrich, transform, or add cross-cutting concerns
 * without touching business logic in Services.
 */
import { injectable, inject } from 'inversify';
import { UserRepository } from '../interfaces/user.repository.js';
import { IUserRepository, UserFilterParams, PaginatedResult } from '../../repositories/interfaces/user.repository.interface.js';
import { User, CreateUserData, UserStatus } from '../../models/user.model.js';
import { TOKENS } from '../../di/tokens.js';

@injectable()
export class UserRepositoryImpl implements UserRepository {
  constructor(
    @inject(TOKENS.UserDao) private readonly userDao: IUserRepository
  ) {}

  // ── BaseRepository ────────────────────────────────────────────────────────

  async save(data: CreateUserData & { passwordHash: string }): Promise<User> {
    return this.userDao.create(data);
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    return this.userDao.update(id, data);
  }

  async findById(id: number): Promise<User | null> {
    return this.userDao.getById(id);
  }

  async findAll(): Promise<User[]> {
    // Return all users (page 1, large page size) — use findAllPaginated for controlled paging.
    const result = await this.userDao.getAll({ page: 1, perPage: 10_000 });
    return result.items;
  }

  async count(params?: Partial<UserFilterParams>): Promise<number> {
    return this.userDao.getCount(params);
  }

  async deleteById(id: number): Promise<boolean> {
    return this.userDao.delete(id);
  }

  async existsById(id: number): Promise<boolean> {
    const user = await this.userDao.getById(id);
    return user !== null;
  }

  // ── UserRepository ────────────────────────────────────────────────────────

  async findByUsername(username: string): Promise<User | null> {
    return this.userDao.getByUsername(username);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userDao.getByEmail(email);
  }

  async findAllPaginated(params: UserFilterParams): Promise<PaginatedResult<User>> {
    return this.userDao.getAll(params);
  }

  async updateLastLogin(id: number): Promise<void> {
    return this.userDao.updateLastLogin(id);
  }

  async updateStatus(id: number, status: UserStatus): Promise<User> {
    return this.userDao.update(id, { status });
  }
}
