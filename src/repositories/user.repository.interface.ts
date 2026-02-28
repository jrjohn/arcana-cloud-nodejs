import { User, CreateUserData, UpdateUserData, UserRole, UserStatus } from '../../models/user.model.js';

export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface UserFilterParams extends PaginationParams {
  role?: UserRole;
  status?: UserStatus;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface IUserRepository {
  create(data: CreateUserData & { passwordHash: string }): Promise<User>;
  getById(id: number): Promise<User | null>;
  getByUsername(username: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  update(id: number, data: Partial<User>): Promise<User>;
  delete(id: number): Promise<boolean>;
  getAll(params: UserFilterParams): Promise<PaginatedResult<User>>;
  getCount(params?: Partial<UserFilterParams>): Promise<number>;
  updateLastLogin(id: number): Promise<void>;
}
