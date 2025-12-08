import { User, UserRole, UserStatus, UserPublic } from '../src/models/user.model.js';
import { OAuthToken, TokenPair } from '../src/models/oauth-token.model.js';

export const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.qfj0WvSvzKqGKu', // 'Test@1234'
  firstName: 'Test',
  lastName: 'User',
  phone: '+1234567890',
  avatarUrl: null,
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  isVerified: true,
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  lastLoginAt: null
};

export const mockAdminUser: User = {
  ...mockUser,
  id: 2,
  username: 'adminuser',
  email: 'admin@example.com',
  role: UserRole.ADMIN
};

export const mockUserPublic: UserPublic = {
  id: mockUser.id,
  username: mockUser.username,
  email: mockUser.email,
  firstName: mockUser.firstName,
  lastName: mockUser.lastName,
  phone: mockUser.phone,
  avatarUrl: mockUser.avatarUrl,
  role: mockUser.role,
  status: mockUser.status,
  isVerified: mockUser.isVerified,
  isActive: mockUser.isActive,
  createdAt: mockUser.createdAt,
  updatedAt: mockUser.updatedAt,
  lastLoginAt: mockUser.lastLoginAt
};

export const mockOAuthToken: OAuthToken = {
  id: 1,
  userId: 1,
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  tokenType: 'Bearer',
  expiresAt: new Date(Date.now() + 3600000),
  clientName: null,
  ipAddress: '127.0.0.1',
  userAgent: 'Test Agent',
  isRevoked: false,
  createdAt: new Date(),
  updatedAt: new Date()
};

export const mockTokenPair: TokenPair = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  tokenType: 'Bearer'
};

export const mockCreateUserData = {
  username: 'newuser',
  email: 'newuser@example.com',
  password: 'Test@1234',
  firstName: 'New',
  lastName: 'User'
};

export const mockUpdateUserData = {
  firstName: 'Updated',
  lastName: 'Name',
  phone: '+9876543210'
};

export const mockLoginData = {
  usernameOrEmail: 'testuser',
  password: 'Test@1234',
  ipAddress: '127.0.0.1',
  userAgent: 'Test Agent'
};

export function createMockUser(overrides: Partial<User> = {}): User {
  return { ...mockUser, ...overrides };
}

export function createMockUsers(count: number): User[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockUser,
    id: i + 1,
    username: `user${i + 1}`,
    email: `user${i + 1}@example.com`
  }));
}
