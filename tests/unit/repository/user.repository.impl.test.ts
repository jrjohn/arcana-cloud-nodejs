/**
 * Tests for UserRepositoryImpl (src/repository/impl/user.repository.impl.ts)
 * This layer delegates to IUserRepository (DAO).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRepositoryImpl } from '../../../src/repository/impl/user.repository.impl.js';
import { IUserRepository } from '../../../src/repositories/user.repository.interface.js';
import { mockUser, createMockUsers, mockCreateUserData } from '../../fixtures.js';
import { UserRole, UserStatus } from '../../../src/models/user.model.js';

describe('UserRepositoryImpl (repository layer)', () => {
  let userDao: IUserRepository;
  let repository: UserRepositoryImpl;

  beforeEach(() => {
    userDao = {
      create: vi.fn(),
      getById: vi.fn(),
      getByUsername: vi.fn(),
      getByEmail: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(),
      getCount: vi.fn(),
      updateLastLogin: vi.fn()
    } as unknown as IUserRepository;

    repository = new UserRepositoryImpl(userDao);
  });

  describe('save', () => {
    it('should delegate to dao.create', async () => {
      const createData = { ...mockCreateUserData, passwordHash: 'hashed' };
      vi.mocked(userDao.create).mockResolvedValue(mockUser);

      const result = await repository.save(createData);

      expect(userDao.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should delegate to dao.update', async () => {
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      vi.mocked(userDao.update).mockResolvedValue(updatedUser);

      const result = await repository.update(1, { firstName: 'Updated' });

      expect(userDao.update).toHaveBeenCalledWith(1, { firstName: 'Updated' });
      expect(result.firstName).toBe('Updated');
    });
  });

  describe('findById', () => {
    it('should delegate to dao.getById and return user', async () => {
      vi.mocked(userDao.getById).mockResolvedValue(mockUser);

      const result = await repository.findById(1);

      expect(userDao.getById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      vi.mocked(userDao.getById).mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all users via paginated call', async () => {
      const users = createMockUsers(3);
      vi.mocked(userDao.getAll).mockResolvedValue({
        items: users,
        pagination: { page: 1, perPage: 10000, total: 3, totalPages: 1 }
      });

      const result = await repository.findAll();

      expect(userDao.getAll).toHaveBeenCalledWith({ page: 1, perPage: 10_000 });
      expect(result).toHaveLength(3);
    });
  });

  describe('count', () => {
    it('should delegate to dao.getCount without params', async () => {
      vi.mocked(userDao.getCount).mockResolvedValue(42);

      const result = await repository.count();

      expect(userDao.getCount).toHaveBeenCalledWith(undefined);
      expect(result).toBe(42);
    });

    it('should delegate to dao.getCount with params', async () => {
      vi.mocked(userDao.getCount).mockResolvedValue(5);

      const result = await repository.count({ role: UserRole.ADMIN });

      expect(userDao.getCount).toHaveBeenCalledWith({ role: UserRole.ADMIN });
      expect(result).toBe(5);
    });
  });

  describe('deleteById', () => {
    it('should delegate to dao.delete', async () => {
      vi.mocked(userDao.delete).mockResolvedValue(true);

      const result = await repository.deleteById(1);

      expect(userDao.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  describe('existsById', () => {
    it('should return true if user exists', async () => {
      vi.mocked(userDao.getById).mockResolvedValue(mockUser);

      const result = await repository.existsById(1);

      expect(result).toBe(true);
    });

    it('should return false if user does not exist', async () => {
      vi.mocked(userDao.getById).mockResolvedValue(null);

      const result = await repository.existsById(999);

      expect(result).toBe(false);
    });
  });

  describe('findByUsername', () => {
    it('should delegate to dao.getByUsername', async () => {
      vi.mocked(userDao.getByUsername).mockResolvedValue(mockUser);

      const result = await repository.findByUsername('testuser');

      expect(userDao.getByUsername).toHaveBeenCalledWith('testuser');
      expect(result).toEqual(mockUser);
    });

    it('should return null if not found', async () => {
      vi.mocked(userDao.getByUsername).mockResolvedValue(null);

      const result = await repository.findByUsername('nobody');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should delegate to dao.getByEmail', async () => {
      vi.mocked(userDao.getByEmail).mockResolvedValue(mockUser);

      const result = await repository.findByEmail('test@example.com');

      expect(userDao.getByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should return null if not found', async () => {
      vi.mocked(userDao.getByEmail).mockResolvedValue(null);

      const result = await repository.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findAllPaginated', () => {
    it('should delegate to dao.getAll with params', async () => {
      const users = createMockUsers(5);
      const pagination = { page: 1, perPage: 5, total: 20, totalPages: 4 };
      vi.mocked(userDao.getAll).mockResolvedValue({ items: users, pagination });

      const result = await repository.findAllPaginated({ page: 1, perPage: 5 });

      expect(userDao.getAll).toHaveBeenCalledWith({ page: 1, perPage: 5 });
      expect(result.items).toHaveLength(5);
      expect(result.pagination).toEqual(pagination);
    });

    it('should forward role and status filters', async () => {
      vi.mocked(userDao.getAll).mockResolvedValue({ items: [], pagination: { page: 1, perPage: 10, total: 0, totalPages: 0 } });

      await repository.findAllPaginated({ page: 1, perPage: 10, role: UserRole.ADMIN, status: UserStatus.ACTIVE });

      expect(userDao.getAll).toHaveBeenCalledWith({
        page: 1, perPage: 10, role: UserRole.ADMIN, status: UserStatus.ACTIVE
      });
    });
  });

  describe('updateLastLogin', () => {
    it('should delegate to dao.updateLastLogin', async () => {
      vi.mocked(userDao.updateLastLogin).mockResolvedValue(undefined);

      await repository.updateLastLogin(1);

      expect(userDao.updateLastLogin).toHaveBeenCalledWith(1);
    });
  });

  describe('updateStatus', () => {
    it('should delegate to dao.update with status', async () => {
      const updatedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      vi.mocked(userDao.update).mockResolvedValue(updatedUser);

      const result = await repository.updateStatus(1, UserStatus.SUSPENDED);

      expect(userDao.update).toHaveBeenCalledWith(1, { status: UserStatus.SUSPENDED });
      expect(result.status).toBe(UserStatus.SUSPENDED);
    });
  });
});
