import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Container } from 'inversify';
import { DirectServiceCommunication, DirectRepositoryCommunication } from '../../../src/communication/implementations/direct.impl.js';
import { TOKENS } from '../../../src/di/tokens.js';
import { UserRole, UserStatus } from '../../../src/models/user.model.js';
import { mockOAuthToken, mockCreateUserData } from '../../fixtures.js';
import { IUserService } from '../../../src/services/interfaces/user.service.interface.js';
import { IAuthService } from '../../../src/services/interfaces/auth.service.interface.js';

describe('DirectServiceCommunication', () => {
  let container: Container;
  let communication: DirectServiceCommunication;
  let mockUserService: Record<string, ReturnType<typeof vi.fn>>;
  let mockAuthService: Record<string, ReturnType<typeof vi.fn>>;

  const mockPublicUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    avatarUrl: null,
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null
  };

  const mockTokenPair = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer'
  };

  const mockAuthResult = {
    user: mockPublicUser,
    tokens: mockTokenPair
  };

  beforeEach(() => {
    // Create mock services
    mockUserService = {
      getUsers: vi.fn(),
      getUserById: vi.fn(),
      getUserByUsername: vi.fn(),
      getUserByEmail: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      changePassword: vi.fn(),
      verifyUser: vi.fn(),
      updateUserStatus: vi.fn()
    };

    mockAuthService = {
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      validateToken: vi.fn(),
      register: vi.fn(),
      revokeAllTokens: vi.fn(),
      getUserTokens: vi.fn(),
      verifyPassword: vi.fn()
    };

    // Create test container with mocks
    container = new Container();
    container.bind<IUserService>(TOKENS.UserService).toConstantValue(mockUserService as unknown as IUserService);
    container.bind<IAuthService>(TOKENS.AuthService).toConstantValue(mockAuthService as unknown as IAuthService);

    // Get the communication instance from container
    container.bind<DirectServiceCommunication>(DirectServiceCommunication).toSelf();
    communication = container.get(DirectServiceCommunication);
  });

  afterEach(() => {
    container.unbindAll();
  });

  describe('User operations', () => {
    it('should get users', async () => {
      const params = { page: 1, perPage: 10 };
      const result = { items: [mockPublicUser], pagination: { page: 1, perPage: 10, total: 1, totalPages: 1 } };
      mockUserService.getUsers.mockResolvedValue(result);

      const response = await communication.getUsers(params);

      expect(mockUserService.getUsers).toHaveBeenCalledWith(params);
      expect(response).toEqual(result);
    });

    it('should get user by id', async () => {
      mockUserService.getUserById.mockResolvedValue(mockPublicUser);

      const response = await communication.getUserById(1);

      expect(mockUserService.getUserById).toHaveBeenCalledWith(1);
      expect(response).toEqual(mockPublicUser);
    });

    it('should create user', async () => {
      mockUserService.createUser.mockResolvedValue(mockPublicUser);

      const response = await communication.createUser(mockCreateUserData);

      expect(mockUserService.createUser).toHaveBeenCalledWith(mockCreateUserData);
      expect(response).toEqual(mockPublicUser);
    });

    it('should update user', async () => {
      const updateData = { firstName: 'Updated' };
      mockUserService.updateUser.mockResolvedValue({ ...mockPublicUser, ...updateData });

      const response = await communication.updateUser(1, updateData);

      expect(mockUserService.updateUser).toHaveBeenCalledWith(1, updateData);
      expect(response.firstName).toBe('Updated');
    });

    it('should delete user', async () => {
      mockUserService.deleteUser.mockResolvedValue(true);

      const response = await communication.deleteUser(1);

      expect(mockUserService.deleteUser).toHaveBeenCalledWith(1);
      expect(response).toBe(true);
    });

    it('should change password', async () => {
      mockUserService.changePassword.mockResolvedValue(true);

      const response = await communication.changePassword(1, {
        oldPassword: 'old',
        newPassword: 'new'
      });

      expect(mockUserService.changePassword).toHaveBeenCalledWith(1, 'old', 'new');
      expect(response).toBe(true);
    });

    it('should verify user', async () => {
      const verifiedUser = { ...mockPublicUser, isVerified: true };
      mockUserService.verifyUser.mockResolvedValue(verifiedUser);

      const response = await communication.verifyUser(1);

      expect(mockUserService.verifyUser).toHaveBeenCalledWith(1);
      expect(response.isVerified).toBe(true);
    });

    it('should update user status', async () => {
      const suspendedUser = { ...mockPublicUser, status: UserStatus.SUSPENDED };
      mockUserService.updateUserStatus.mockResolvedValue(suspendedUser);

      const response = await communication.updateUserStatus(1, UserStatus.SUSPENDED);

      expect(mockUserService.updateUserStatus).toHaveBeenCalledWith(1, UserStatus.SUSPENDED);
      expect(response.status).toBe(UserStatus.SUSPENDED);
    });
  });

  describe('Auth operations', () => {
    it('should login', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResult);

      const loginData = { usernameOrEmail: 'testuser', password: 'password' };
      const response = await communication.login(loginData);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginData);
      expect(response).toEqual(mockAuthResult);
    });

    it('should logout', async () => {
      mockAuthService.logout.mockResolvedValue(true);

      const response = await communication.logout('access-token');

      expect(mockAuthService.logout).toHaveBeenCalledWith('access-token');
      expect(response).toBe(true);
    });

    it('should refresh token', async () => {
      mockAuthService.refreshToken.mockResolvedValue(mockTokenPair);

      const response = await communication.refreshToken('refresh-token');

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('refresh-token');
      expect(response).toEqual(mockTokenPair);
    });

    it('should validate token', async () => {
      mockAuthService.validateToken.mockResolvedValue(mockPublicUser);

      const response = await communication.validateToken('access-token');

      expect(mockAuthService.validateToken).toHaveBeenCalledWith('access-token');
      expect(response).toEqual(mockPublicUser);
    });

    it('should register', async () => {
      mockAuthService.register.mockResolvedValue(mockAuthResult);

      const response = await communication.register(mockCreateUserData);

      expect(mockAuthService.register).toHaveBeenCalledWith(mockCreateUserData);
      expect(response).toEqual(mockAuthResult);
    });

    it('should revoke all tokens', async () => {
      mockAuthService.revokeAllTokens.mockResolvedValue(5);

      const response = await communication.revokeAllTokens(1);

      expect(mockAuthService.revokeAllTokens).toHaveBeenCalledWith(1);
      expect(response).toBe(5);
    });

    it('should get user tokens', async () => {
      const tokens = [mockOAuthToken];
      mockAuthService.getUserTokens.mockResolvedValue(tokens);

      const response = await communication.getUserTokens(1);

      expect(mockAuthService.getUserTokens).toHaveBeenCalledWith(1);
      expect(response).toEqual(tokens);
    });
  });
});

describe('DirectRepositoryCommunication', () => {
  let communication: DirectRepositoryCommunication;

  beforeEach(() => {
    communication = new DirectRepositoryCommunication();
  });

  it('should throw error for query', async () => {
    await expect(communication.query('users', {})).rejects.toThrow(
      'Direct repository communication not fully implemented'
    );
  });

  it('should throw error for getById', async () => {
    await expect(communication.getById('users', 1)).rejects.toThrow(
      'Direct repository communication not fully implemented'
    );
  });

  it('should throw error for create', async () => {
    await expect(communication.create('users', {})).rejects.toThrow(
      'Direct repository communication not fully implemented'
    );
  });

  it('should throw error for update', async () => {
    await expect(communication.update('users', 1, {})).rejects.toThrow(
      'Direct repository communication not fully implemented'
    );
  });

  it('should throw error for delete', async () => {
    await expect(communication.delete('users', 1)).rejects.toThrow(
      'Direct repository communication not fully implemented'
    );
  });

  it('should throw error for count', async () => {
    await expect(communication.count('users')).rejects.toThrow(
      'Direct repository communication not fully implemented'
    );
  });
});
