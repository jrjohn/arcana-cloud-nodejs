import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { HTTPServiceCommunication, HTTPRepositoryCommunication } from '../../../src/communication/implementations/http.impl.js';
import { UserRole, UserStatus } from '../../../src/models/user.model.js';

vi.mock('axios');
vi.mock('../../../src/utils/helpers.js', () => ({
  delay: vi.fn().mockResolvedValue(undefined)
}));

describe('HTTPServiceCommunication', () => {
  let communication: HTTPServiceCommunication;
  let mockAxiosInstance: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: null
  };

  const mockTokenPair = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer'
  };

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };

    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as unknown as ReturnType<typeof axios.create>);
    communication = new HTTPServiceCommunication(['http://localhost:5001']);
  });

  describe('constructor', () => {
    it('should create axios clients for each URL', () => {
      new HTTPServiceCommunication(['http://service1:5001', 'http://service2:5001']);

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://service1:5001',
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://service2:5001',
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  describe('User operations', () => {
    it('should get users', async () => {
      const result = {
        items: [mockPublicUser],
        pagination: { page: 1, perPage: 10, total: 1, totalPages: 1 }
      };
      mockAxiosInstance.get.mockResolvedValue({ data: { data: result } });

      const response = await communication.getUsers({ page: 1, perPage: 10 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/internal/users', {
        params: { page: 1, perPage: 10 }
      });
      expect(response).toEqual(result);
    });

    it('should get user by id', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { data: mockPublicUser } });

      const response = await communication.getUserById(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/internal/users/1');
      expect(response).toEqual(mockPublicUser);
    });

    it('should create user', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { data: mockPublicUser } });

      const createData = { username: 'new', email: 'new@example.com', password: 'Test@1234' };
      const response = await communication.createUser(createData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/internal/users', createData);
      expect(response).toEqual(mockPublicUser);
    });

    it('should update user', async () => {
      const updatedUser = { ...mockPublicUser, firstName: 'Updated' };
      mockAxiosInstance.put.mockResolvedValue({ data: { data: updatedUser } });

      const response = await communication.updateUser(1, { firstName: 'Updated' });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/internal/users/1', { firstName: 'Updated' });
      expect(response.firstName).toBe('Updated');
    });

    it('should delete user', async () => {
      mockAxiosInstance.delete.mockResolvedValue({});

      const response = await communication.deleteUser(1);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/internal/users/1');
      expect(response).toBe(true);
    });

    it('should change password', async () => {
      mockAxiosInstance.put.mockResolvedValue({});

      const response = await communication.changePassword(1, {
        oldPassword: 'old',
        newPassword: 'new'
      });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/internal/users/1/password', {
        oldPassword: 'old',
        newPassword: 'new'
      });
      expect(response).toBe(true);
    });

    it('should verify user', async () => {
      const verifiedUser = { ...mockPublicUser, isVerified: true };
      mockAxiosInstance.post.mockResolvedValue({ data: { data: verifiedUser } });

      const response = await communication.verifyUser(1);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/internal/users/1/verify');
      expect(response.isVerified).toBe(true);
    });

    it('should update user status', async () => {
      const suspendedUser = { ...mockPublicUser, status: UserStatus.SUSPENDED };
      mockAxiosInstance.put.mockResolvedValue({ data: { data: suspendedUser } });

      const response = await communication.updateUserStatus(1, UserStatus.SUSPENDED);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/internal/users/1/status', {
        status: UserStatus.SUSPENDED
      });
      expect(response.status).toBe(UserStatus.SUSPENDED);
    });
  });

  describe('Auth operations', () => {
    it('should login', async () => {
      const authResult = { user: mockPublicUser, tokens: mockTokenPair };
      mockAxiosInstance.post.mockResolvedValue({ data: { data: authResult } });

      const loginData = { usernameOrEmail: 'testuser', password: 'password' };
      const response = await communication.login(loginData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/internal/auth/login', loginData);
      expect(response).toEqual(authResult);
    });

    it('should logout', async () => {
      mockAxiosInstance.post.mockResolvedValue({});

      const response = await communication.logout('access-token');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/internal/auth/logout', {
        token: 'access-token'
      });
      expect(response).toBe(true);
    });

    it('should refresh token', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { data: mockTokenPair } });

      const response = await communication.refreshToken('refresh-token');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/internal/auth/refresh', {
        refreshToken: 'refresh-token'
      });
      expect(response).toEqual(mockTokenPair);
    });

    it('should validate token', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { data: mockPublicUser } });

      const response = await communication.validateToken('access-token');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/internal/auth/validate', {
        token: 'access-token'
      });
      expect(response).toEqual(mockPublicUser);
    });

    it('should register', async () => {
      const authResult = { user: mockPublicUser, tokens: mockTokenPair };
      mockAxiosInstance.post.mockResolvedValue({ data: { data: authResult } });

      const registerData = { username: 'new', email: 'new@example.com', password: 'Test@1234' };
      const response = await communication.register(registerData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/internal/auth/register', registerData);
      expect(response).toEqual(authResult);
    });

    it('should revoke all tokens', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { data: { count: 5 } } });

      const response = await communication.revokeAllTokens(1);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/internal/auth/tokens/revoke-all', {
        userId: 1
      });
      expect(response).toBe(5);
    });

    it('should get user tokens', async () => {
      const tokens = [{ id: 1, accessToken: 'token' }];
      mockAxiosInstance.get.mockResolvedValue({ data: { data: tokens } });

      const response = await communication.getUserTokens(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/internal/auth/tokens/1');
      expect(response).toEqual(tokens);
    });
  });

  describe('retry logic', () => {
    it('should retry on failure', async () => {
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { data: mockPublicUser } });

      const response = await communication.getUserById(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(response).toEqual(mockPublicUser);
    });

    it('should throw after max retries', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(communication.getUserById(1)).rejects.toThrow('Network error');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it('should use round-robin for load balancing', async () => {
      const mockClient1 = { get: vi.fn().mockResolvedValue({ data: { data: mockPublicUser } }) };
      const mockClient2 = { get: vi.fn().mockResolvedValue({ data: { data: mockPublicUser } }) };

      vi.mocked(axios.create)
        .mockReturnValueOnce(mockClient1 as unknown as ReturnType<typeof axios.create>)
        .mockReturnValueOnce(mockClient2 as unknown as ReturnType<typeof axios.create>);

      const comm = new HTTPServiceCommunication(['http://service1:5001', 'http://service2:5001']);

      await comm.getUserById(1);
      await comm.getUserById(2);

      expect(mockClient1.get).toHaveBeenCalled();
      expect(mockClient2.get).toHaveBeenCalled();
    });
  });
});

describe('HTTPRepositoryCommunication', () => {
  let communication: HTTPRepositoryCommunication;
  let mockAxiosInstance: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };

    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as unknown as ReturnType<typeof axios.create>);
    communication = new HTTPRepositoryCommunication(['http://localhost:5002']);
  });

  it('should query entities', async () => {
    const users = [{ id: 1, username: 'test' }];
    mockAxiosInstance.get.mockResolvedValue({ data: { data: users } });

    const response = await communication.query('users', { status: 'active' });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/repository/users', {
      params: { status: 'active' }
    });
    expect(response).toEqual(users);
  });

  it('should get entity by id', async () => {
    const user = { id: 1, username: 'test' };
    mockAxiosInstance.get.mockResolvedValue({ data: { data: user } });

    const response = await communication.getById('users', 1);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/repository/users/1');
    expect(response).toEqual(user);
  });

  it('should create entity', async () => {
    const user = { id: 1, username: 'new' };
    mockAxiosInstance.post.mockResolvedValue({ data: { data: user } });

    const response = await communication.create('users', { username: 'new' });

    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/repository/users', { username: 'new' });
    expect(response).toEqual(user);
  });

  it('should update entity', async () => {
    const user = { id: 1, username: 'updated' };
    mockAxiosInstance.put.mockResolvedValue({ data: { data: user } });

    const response = await communication.update('users', 1, { username: 'updated' });

    expect(mockAxiosInstance.put).toHaveBeenCalledWith('/repository/users/1', { username: 'updated' });
    expect(response).toEqual(user);
  });

  it('should delete entity', async () => {
    mockAxiosInstance.delete.mockResolvedValue({});

    const response = await communication.delete('users', 1);

    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/repository/users/1');
    expect(response).toBe(true);
  });

  it('should count entities', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: { data: { count: 100 } } });

    const response = await communication.count('users', { status: 'active' });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/repository/users/count', {
      params: { status: 'active' }
    });
    expect(response).toBe(100);
  });
});
