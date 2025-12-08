import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { UserServiceImpl } from '../../../src/services/implementations/user.service.impl.js';
import { IUserRepository } from '../../../src/repositories/interfaces/user.repository.interface.js';
import { mockUser, mockCreateUserData, mockUpdateUserData, createMockUsers } from '../../fixtures.js';
import { NotFoundError, ConflictError, AuthenticationError } from '../../../src/utils/exceptions.js';
import { UserStatus } from '../../../src/models/user.model.js';

vi.mock('bcrypt');

describe('UserServiceImpl', () => {
  let service: UserServiceImpl;
  let mockRepository: IUserRepository;

  beforeEach(() => {
    mockRepository = {
      create: vi.fn(),
      getById: vi.fn(),
      getByUsername: vi.fn(),
      getByEmail: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(),
      getCount: vi.fn(),
      updateLastLogin: vi.fn()
    };

    service = new UserServiceImpl(mockRepository);

    vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      vi.mocked(mockRepository.getByUsername).mockResolvedValue(null);
      vi.mocked(mockRepository.getByEmail).mockResolvedValue(null);
      vi.mocked(mockRepository.create).mockResolvedValue(mockUser);

      const result = await service.createUser(mockCreateUserData);

      expect(mockRepository.getByUsername).toHaveBeenCalledWith(mockCreateUserData.username);
      expect(mockRepository.getByEmail).toHaveBeenCalledWith(mockCreateUserData.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(mockCreateUserData.password, 12);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictError if username exists', async () => {
      vi.mocked(mockRepository.getByUsername).mockResolvedValue(mockUser);

      await expect(service.createUser(mockCreateUserData)).rejects.toThrow(ConflictError);
      await expect(service.createUser(mockCreateUserData)).rejects.toThrow('Username already exists');
    });

    it('should throw ConflictError if email exists', async () => {
      vi.mocked(mockRepository.getByUsername).mockResolvedValue(null);
      vi.mocked(mockRepository.getByEmail).mockResolvedValue(mockUser);

      await expect(service.createUser(mockCreateUserData)).rejects.toThrow(ConflictError);
      await expect(service.createUser(mockCreateUserData)).rejects.toThrow('Email already exists');
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(mockUser);

      const result = await service.getUserById(1);

      expect(mockRepository.getById).toHaveBeenCalledWith(1);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe(mockUser.id);
    });

    it('should throw NotFoundError if user not found', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.getUserById(999)).rejects.toThrow(NotFoundError);
      await expect(service.getUserById(999)).rejects.toThrow('User not found');
    });
  });

  describe('getUserByUsername', () => {
    it('should return user by username', async () => {
      vi.mocked(mockRepository.getByUsername).mockResolvedValue(mockUser);

      const result = await service.getUserByUsername('testuser');

      expect(mockRepository.getByUsername).toHaveBeenCalledWith('testuser');
      expect(result.username).toBe(mockUser.username);
    });

    it('should throw NotFoundError if user not found', async () => {
      vi.mocked(mockRepository.getByUsername).mockResolvedValue(null);

      await expect(service.getUserByUsername('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      vi.mocked(mockRepository.getByEmail).mockResolvedValue(mockUser);

      const result = await service.getUserByEmail('test@example.com');

      expect(mockRepository.getByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw NotFoundError if user not found', async () => {
      vi.mocked(mockRepository.getByEmail).mockResolvedValue(null);

      await expect(service.getUserByEmail('nonexistent@example.com')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateUser', () => {
    it('should update user', async () => {
      const updatedUser = { ...mockUser, ...mockUpdateUserData };
      vi.mocked(mockRepository.getById).mockResolvedValue(mockUser);
      vi.mocked(mockRepository.update).mockResolvedValue(updatedUser);

      const result = await service.updateUser(1, mockUpdateUserData);

      expect(mockRepository.update).toHaveBeenCalledWith(1, mockUpdateUserData);
      expect(result.firstName).toBe(mockUpdateUserData.firstName);
    });

    it('should throw NotFoundError if user not found', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.updateUser(999, mockUpdateUserData)).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if new email already exists', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(mockUser);
      vi.mocked(mockRepository.getByEmail).mockResolvedValue({ ...mockUser, id: 2 });

      await expect(service.updateUser(1, { email: 'existing@example.com' })).rejects.toThrow(ConflictError);
    });

    it('should allow updating to same email', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(mockUser);
      vi.mocked(mockRepository.update).mockResolvedValue(mockUser);

      await service.updateUser(1, { email: mockUser.email });

      expect(mockRepository.getByEmail).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(mockUser);
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteUser(1);

      expect(mockRepository.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should throw NotFoundError if user not found', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.deleteUser(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(mockRepository.update).mockResolvedValue(mockUser);

      const result = await service.changePassword(1, 'oldPassword', 'NewPass@123');

      expect(bcrypt.compare).toHaveBeenCalledWith('oldPassword', mockUser.passwordHash);
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass@123', 12);
      expect(result).toBe(true);
    });

    it('should throw NotFoundError if user not found', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.changePassword(999, 'old', 'new')).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthenticationError if old password is incorrect', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.changePassword(1, 'wrongPassword', 'NewPass@123'))
        .rejects.toThrow(AuthenticationError);
    });
  });

  describe('verifyUser', () => {
    it('should verify user', async () => {
      const unverifiedUser = { ...mockUser, isVerified: false };
      const verifiedUser = { ...mockUser, isVerified: true };
      vi.mocked(mockRepository.getById).mockResolvedValue(unverifiedUser);
      vi.mocked(mockRepository.update).mockResolvedValue(verifiedUser);

      const result = await service.verifyUser(1);

      expect(mockRepository.update).toHaveBeenCalledWith(1, { isVerified: true });
      expect(result.isVerified).toBe(true);
    });

    it('should throw NotFoundError if user not found', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.verifyUser(999)).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if already verified', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(mockUser); // mockUser.isVerified = true

      await expect(service.verifyUser(1)).rejects.toThrow(ConflictError);
      await expect(service.verifyUser(1)).rejects.toThrow('User is already verified');
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      vi.mocked(mockRepository.getById).mockResolvedValue(mockUser);
      vi.mocked(mockRepository.update).mockResolvedValue(suspendedUser);

      const result = await service.updateUserStatus(1, UserStatus.SUSPENDED);

      expect(mockRepository.update).toHaveBeenCalledWith(1, { status: UserStatus.SUSPENDED });
      expect(result.status).toBe(UserStatus.SUSPENDED);
    });

    it('should throw NotFoundError if user not found', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.updateUserStatus(999, UserStatus.INACTIVE)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const users = createMockUsers(5);
      const pagination = { page: 1, perPage: 10, total: 5, totalPages: 1 };
      vi.mocked(mockRepository.getAll).mockResolvedValue({ items: users, pagination });

      const result = await service.getUsers({ page: 1, perPage: 10 });

      expect(result.items).toHaveLength(5);
      expect(result.pagination).toEqual(pagination);
      result.items.forEach(user => {
        expect(user).not.toHaveProperty('passwordHash');
      });
    });
  });
});
