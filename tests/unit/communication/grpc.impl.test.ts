import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { GRPCServiceCommunication, GRPCRepositoryCommunication } from '../../../src/communication/impl/grpc.impl.js';
import { UserRole, UserStatus } from '../../../src/models/user.model.js';

vi.mock('@grpc/grpc-js');
vi.mock('@grpc/proto-loader');

describe('GRPCServiceCommunication', () => {
  let communication: GRPCServiceCommunication;
  let mockClient: Record<string, ReturnType<typeof vi.fn>>;
  let MockServiceClient: ReturnType<typeof vi.fn>;

  const mockGrpcUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    phone: null,
    avatar_url: null,
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    is_verified: true,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    last_login_at: null
  };

  const mockGrpcTokens = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'Bearer'
  };

  beforeEach(() => {
    mockClient = {
      GetUsers: vi.fn(),
      GetUserById: vi.fn(),
      CreateUser: vi.fn(),
      UpdateUser: vi.fn(),
      DeleteUser: vi.fn(),
      ChangePassword: vi.fn(),
      VerifyUser: vi.fn(),
      UpdateUserStatus: vi.fn(),
      Login: vi.fn(),
      Logout: vi.fn(),
      RefreshToken: vi.fn(),
      ValidateToken: vi.fn(),
      Register: vi.fn(),
      RevokeAllTokens: vi.fn(),
      GetUserTokens: vi.fn()
    };

    MockServiceClient = vi.fn().mockImplementation(() => mockClient);

    vi.mocked(protoLoader.loadSync).mockReturnValue({} as protoLoader.PackageDefinition);
    vi.mocked(grpc.loadPackageDefinition).mockReturnValue({
      arcana: { UserService: MockServiceClient }
    } as unknown as grpc.GrpcObject);
    vi.mocked(grpc.credentials.createInsecure).mockReturnValue({} as grpc.ChannelCredentials);

    communication = new GRPCServiceCommunication(['localhost:50051']);
  });

  describe('constructor', () => {
    it('should load proto file and create clients', () => {
      expect(protoLoader.loadSync).toHaveBeenCalledWith(
        './src/grpc/protos/user_service.proto',
        expect.objectContaining({
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true
        })
      );
      expect(MockServiceClient).toHaveBeenCalledWith('localhost:50051', expect.anything());
    });

    it('should create multiple clients for multiple URLs', () => {
      new GRPCServiceCommunication(['localhost:50051', 'localhost:50052']);

      expect(MockServiceClient).toHaveBeenCalledTimes(3); // Including the one from beforeEach
    });
  });

  describe('User operations', () => {
    it('should get users', async () => {
      const response = {
        users: [mockGrpcUser],
        pagination: { page: 1, per_page: 10, total: 1, total_pages: 1 }
      };
      mockClient.GetUsers.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, response);
      });

      const result = await communication.getUsers({ page: 1, perPage: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should get user by id', async () => {
      mockClient.GetUserById.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, mockGrpcUser);
      });

      const result = await communication.getUserById(1);

      expect(mockClient.GetUserById).toHaveBeenCalledWith(
        { user_id: 1 },
        expect.any(Function)
      );
      expect(result.id).toBe(1);
      expect(result.username).toBe('testuser');
    });

    it('should handle error in getUserById', async () => {
      mockClient.GetUserById.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(new Error('Not found'), null);
      });

      await expect(communication.getUserById(999)).rejects.toThrow('Not found');
    });

    it('should create user', async () => {
      mockClient.CreateUser.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, mockGrpcUser);
      });

      const createData = { username: 'new', email: 'new@example.com', password: 'Test@1234' };
      const result = await communication.createUser(createData);

      expect(mockClient.CreateUser).toHaveBeenCalledWith(createData, expect.any(Function));
      expect(result.username).toBe('testuser');
    });

    it('should update user', async () => {
      const updatedUser = { ...mockGrpcUser, first_name: 'Updated' };
      mockClient.UpdateUser.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, updatedUser);
      });

      const result = await communication.updateUser(1, { firstName: 'Updated' });

      expect(mockClient.UpdateUser).toHaveBeenCalledWith(
        { user_id: 1, firstName: 'Updated' },
        expect.any(Function)
      );
      expect(result.firstName).toBe('Updated');
    });

    it('should delete user', async () => {
      mockClient.DeleteUser.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, { success: true });
      });

      const result = await communication.deleteUser(1);

      expect(mockClient.DeleteUser).toHaveBeenCalledWith(
        { user_id: 1 },
        expect.any(Function)
      );
      expect(result).toBe(true);
    });

    it('should change password', async () => {
      mockClient.ChangePassword.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, { success: true });
      });

      const result = await communication.changePassword(1, {
        oldPassword: 'old',
        newPassword: 'new'
      });

      expect(mockClient.ChangePassword).toHaveBeenCalledWith(
        { user_id: 1, old_password: 'old', new_password: 'new' },
        expect.any(Function)
      );
      expect(result).toBe(true);
    });

    it('should verify user', async () => {
      const verifiedUser = { ...mockGrpcUser, is_verified: true };
      mockClient.VerifyUser.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, verifiedUser);
      });

      const result = await communication.verifyUser(1);

      expect(mockClient.VerifyUser).toHaveBeenCalledWith(
        { user_id: 1 },
        expect.any(Function)
      );
      expect(result.isVerified).toBe(true);
    });

    it('should update user status', async () => {
      const suspendedUser = { ...mockGrpcUser, status: UserStatus.SUSPENDED };
      mockClient.UpdateUserStatus.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, suspendedUser);
      });

      const result = await communication.updateUserStatus(1, UserStatus.SUSPENDED);

      expect(mockClient.UpdateUserStatus).toHaveBeenCalledWith(
        { user_id: 1, status: UserStatus.SUSPENDED },
        expect.any(Function)
      );
      expect(result.status).toBe(UserStatus.SUSPENDED);
    });
  });

  describe('Auth operations', () => {
    it('should login', async () => {
      mockClient.Login.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, { user: mockGrpcUser, tokens: mockGrpcTokens });
      });

      const result = await communication.login({ usernameOrEmail: 'test', password: 'pass' });

      expect(result.user.id).toBe(1);
      expect(result.tokens.accessToken).toBe('access-token');
    });

    it('should logout', async () => {
      mockClient.Logout.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, { success: true });
      });

      const result = await communication.logout('token');

      expect(mockClient.Logout).toHaveBeenCalledWith({ token: 'token' }, expect.any(Function));
      expect(result).toBe(true);
    });

    it('should refresh token', async () => {
      mockClient.RefreshToken.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, mockGrpcTokens);
      });

      const result = await communication.refreshToken('refresh-token');

      expect(mockClient.RefreshToken).toHaveBeenCalledWith(
        { refresh_token: 'refresh-token' },
        expect.any(Function)
      );
      expect(result.accessToken).toBe('access-token');
    });

    it('should validate token', async () => {
      mockClient.ValidateToken.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, { user: mockGrpcUser });
      });

      const result = await communication.validateToken('token');

      expect(mockClient.ValidateToken).toHaveBeenCalledWith(
        { token: 'token' },
        expect.any(Function)
      );
      expect(result.id).toBe(1);
    });

    it('should register', async () => {
      mockClient.Register.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, { user: mockGrpcUser, tokens: mockGrpcTokens });
      });

      const registerData = { username: 'new', email: 'new@example.com', password: 'Test@1234' };
      const result = await communication.register(registerData);

      expect(result.user.id).toBe(1);
      expect(result.tokens.accessToken).toBe('access-token');
    });

    it('should revoke all tokens', async () => {
      mockClient.RevokeAllTokens.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, { count: 5 });
      });

      const result = await communication.revokeAllTokens(1);

      expect(mockClient.RevokeAllTokens).toHaveBeenCalledWith(
        { user_id: 1 },
        expect.any(Function)
      );
      expect(result).toBe(5);
    });

    it('should get user tokens', async () => {
      const tokens = [{ id: 1, accessToken: 'token' }];
      mockClient.GetUserTokens.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, { tokens });
      });

      const result = await communication.getUserTokens(1);

      expect(mockClient.GetUserTokens).toHaveBeenCalledWith(
        { user_id: 1 },
        expect.any(Function)
      );
      expect(result).toEqual(tokens);
    });
  });

  describe('transformUser', () => {
    it('should transform gRPC user to domain user', async () => {
      mockClient.GetUserById.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
        cb(null, mockGrpcUser);
      });

      const result = await communication.getUserById(1);

      expect(result).toEqual({
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
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastLoginAt: null
      });
    });
  });
});

describe('GRPCRepositoryCommunication', () => {
  let communication: GRPCRepositoryCommunication;
  let mockClient: Record<string, ReturnType<typeof vi.fn>>;
  let MockServiceClient: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockClient = {
      Query: vi.fn(),
      GetById: vi.fn(),
      Create: vi.fn(),
      Update: vi.fn(),
      Delete: vi.fn(),
      Count: vi.fn()
    };

    MockServiceClient = vi.fn().mockImplementation(() => mockClient);

    vi.mocked(protoLoader.loadSync).mockReturnValue({} as protoLoader.PackageDefinition);
    vi.mocked(grpc.loadPackageDefinition).mockReturnValue({
      arcana: { RepositoryService: MockServiceClient }
    } as unknown as grpc.GrpcObject);
    vi.mocked(grpc.credentials.createInsecure).mockReturnValue({} as grpc.ChannelCredentials);

    communication = new GRPCRepositoryCommunication(['localhost:50052']);
  });

  it('should query entities', async () => {
    const users = [{ id: 1, username: 'test' }];
    mockClient.Query.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
      cb(null, { data: JSON.stringify(users) });
    });

    const result = await communication.query('users', { status: 'active' });

    expect(mockClient.Query).toHaveBeenCalledWith(
      { entity: 'users', params: JSON.stringify({ status: 'active' }) },
      expect.any(Function)
    );
    expect(result).toEqual(users);
  });

  it('should get entity by id', async () => {
    const user = { id: 1, username: 'test' };
    mockClient.GetById.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
      cb(null, { data: JSON.stringify(user) });
    });

    const result = await communication.getById('users', 1);

    expect(mockClient.GetById).toHaveBeenCalledWith(
      { entity: 'users', id: 1 },
      expect.any(Function)
    );
    expect(result).toEqual(user);
  });

  it('should return null for non-existent entity', async () => {
    mockClient.GetById.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
      cb(null, { data: null });
    });

    const result = await communication.getById('users', 999);

    expect(result).toBeNull();
  });

  it('should create entity', async () => {
    const user = { id: 1, username: 'new' };
    mockClient.Create.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
      cb(null, { data: JSON.stringify(user) });
    });

    const result = await communication.create('users', { username: 'new' });

    expect(mockClient.Create).toHaveBeenCalledWith(
      { entity: 'users', data: JSON.stringify({ username: 'new' }) },
      expect.any(Function)
    );
    expect(result).toEqual(user);
  });

  it('should update entity', async () => {
    const user = { id: 1, username: 'updated' };
    mockClient.Update.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
      cb(null, { data: JSON.stringify(user) });
    });

    const result = await communication.update('users', 1, { username: 'updated' });

    expect(mockClient.Update).toHaveBeenCalledWith(
      { entity: 'users', id: 1, data: JSON.stringify({ username: 'updated' }) },
      expect.any(Function)
    );
    expect(result).toEqual(user);
  });

  it('should delete entity', async () => {
    mockClient.Delete.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
      cb(null, { success: true });
    });

    const result = await communication.delete('users', 1);

    expect(mockClient.Delete).toHaveBeenCalledWith(
      { entity: 'users', id: 1 },
      expect.any(Function)
    );
    expect(result).toBe(true);
  });

  it('should count entities', async () => {
    mockClient.Count.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
      cb(null, { count: 100 });
    });

    const result = await communication.count('users', { status: 'active' });

    expect(mockClient.Count).toHaveBeenCalledWith(
      { entity: 'users', params: JSON.stringify({ status: 'active' }) },
      expect.any(Function)
    );
    expect(result).toBe(100);
  });

  it('should handle errors', async () => {
    mockClient.Query.mockImplementation((params: unknown, cb: (err: Error | null, res: unknown) => void) => {
      cb(new Error('gRPC error'), null);
    });

    await expect(communication.query('users', {})).rejects.toThrow('gRPC error');
  });
});
