import { PrismaClient } from '@prisma/client';
import {
  IUserRepository,
  UserFilterParams,
  PaginatedResult
} from '../interfaces/user.repository.interface.js';
import { User, CreateUserData, UserRole, UserStatus } from '../../models/user.model.js';

export class UserRepositoryImpl implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateUserData & { passwordHash: string }): Promise<User> {
    const { password, ...userData } = data as CreateUserData & { passwordHash: string; password?: string };
    return this.prisma.user.create({
      data: {
        username: userData.username,
        email: userData.email,
        passwordHash: userData.passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: userData.role as UserRole || UserRole.USER
      }
    }) as unknown as User;
  }

  async getById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id }
    }) as unknown as User | null;
  }

  async getByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username }
    }) as unknown as User | null;
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email }
    }) as unknown as User | null;
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data
    }) as unknown as User;
  }

  async delete(id: number): Promise<boolean> {
    await this.prisma.user.delete({
      where: { id }
    });
    return true;
  }

  async getAll(params: UserFilterParams): Promise<PaginatedResult<User>> {
    const { page, perPage, role, status } = params;
    const skip = (page - 1) * perPage;

    const where: { role?: UserRole; status?: UserStatus } = {};
    if (role) where.role = role;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      items: items as unknown as User[],
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  async getCount(params?: Partial<UserFilterParams>): Promise<number> {
    const where: { role?: UserRole; status?: UserStatus } = {};
    if (params?.role) where.role = params.role;
    if (params?.status) where.status = params.status;

    return this.prisma.user.count({ where });
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() }
    });
  }
}
