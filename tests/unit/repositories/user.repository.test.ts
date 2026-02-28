import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRepositoryImpl } from '../../../src/repositories/impl/user.repository.impl.js';
import { mockPrisma, mockPrismaUser, resetPrismaMocks } from '../../mocks/prisma.mock.js';
import { mockUser, createMockUsers, mockCreateUserData } from '../../fixtures.js';
import { UserRole, UserStatus } from '../../../src/models/user.model.js';

describe('UserRepositoryImpl', () => {
  let repository: UserRepositoryImpl;

  beforeEach(() => {
    resetPrismaMocks();
    repository = new UserRepositoryImpl(mockPrisma);
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createData = {
        ...mockCreateUserData,
        passwordHash: 'hashed-password'
      };

      mockPrismaUser.create.mockResolvedValue({ ...mockUser, ...createData });

      const result = await repository.create(createData);

      expect(mockPrismaUser.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: createData.username,
          email: createData.email,
          passwordHash: createData.passwordHash
        })
      });
      expect(result.username).toBe(createData.username);
    });
  });

  describe('getById', () => {
    it('should return user by id', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(mockUser);

      const result = await repository.getById(1);

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const result = await repository.getById(999);

      expect(result).toBeNull();
    });
  });

  describe('getByUsername', () => {
    it('should return user by username', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(mockUser);

      const result = await repository.getByUsername('testuser');

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' }
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const result = await repository.getByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByEmail', () => {
    it('should return user by email', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(mockUser);

      const result = await repository.getByEmail('test@example.com');

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const result = await repository.getByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      mockPrismaUser.update.mockResolvedValue(updatedUser);

      const result = await repository.update(1, { firstName: 'Updated' });

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { firstName: 'Updated' }
      });
      expect(result.firstName).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('should delete user and return true', async () => {
      mockPrismaUser.delete.mockResolvedValue(mockUser);

      const result = await repository.delete(1);

      expect(mockPrismaUser.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(result).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return paginated users', async () => {
      const users = createMockUsers(5);
      mockPrismaUser.findMany.mockResolvedValue(users);
      mockPrismaUser.count.mockResolvedValue(25);

      const result = await repository.getAll({ page: 1, perPage: 5 });

      expect(mockPrismaUser.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 5,
        orderBy: { createdAt: 'desc' }
      });
      expect(result.items).toHaveLength(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.perPage).toBe(5);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(5);
    });

    it('should filter by role', async () => {
      mockPrismaUser.findMany.mockResolvedValue([]);
      mockPrismaUser.count.mockResolvedValue(0);

      await repository.getAll({ page: 1, perPage: 10, role: UserRole.ADMIN });

      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: UserRole.ADMIN }
        })
      );
    });

    it('should filter by status', async () => {
      mockPrismaUser.findMany.mockResolvedValue([]);
      mockPrismaUser.count.mockResolvedValue(0);

      await repository.getAll({ page: 1, perPage: 10, status: UserStatus.ACTIVE });

      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: UserStatus.ACTIVE }
        })
      );
    });

    it('should calculate correct skip for pagination', async () => {
      mockPrismaUser.findMany.mockResolvedValue([]);
      mockPrismaUser.count.mockResolvedValue(0);

      await repository.getAll({ page: 3, perPage: 10 });

      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10
        })
      );
    });
  });

  describe('getCount', () => {
    it('should return total count', async () => {
      mockPrismaUser.count.mockResolvedValue(50);

      const result = await repository.getCount();

      expect(mockPrismaUser.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toBe(50);
    });

    it('should return filtered count', async () => {
      mockPrismaUser.count.mockResolvedValue(10);

      const result = await repository.getCount({ role: UserRole.ADMIN });

      expect(mockPrismaUser.count).toHaveBeenCalledWith({
        where: { role: UserRole.ADMIN }
      });
      expect(result).toBe(10);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      mockPrismaUser.update.mockResolvedValue(mockUser);

      await repository.updateLastLogin(1);

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { lastLoginAt: expect.any(Date) }
      });
    });
  });
});
