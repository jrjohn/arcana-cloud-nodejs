import { User, UserPublic, CreateUserData, UpdateUserData, UserStatus } from '../models/user.model.js';
import { TokenPair, OAuthToken } from '../models/oauth-token.model.js';
import { PaginatedResult, UserFilterParams } from '../repositories/interfaces/user.repository.interface.js';

export enum DeploymentMode {
  MONOLITHIC = 'monolithic',
  LAYERED = 'layered',
  MICROSERVICES = 'microservices'
}

export enum CommunicationProtocol {
  DIRECT = 'direct',
  HTTP = 'http',
  GRPC = 'grpc'
}

export enum DeploymentLayer {
  MONOLITHIC = 'monolithic',
  CONTROLLER = 'controller',
  SERVICE = 'service',
  REPOSITORY = 'repository'
}

export interface GetUsersParams extends UserFilterParams {}

export interface ChangePasswordData {
  oldPassword: string;
  newPassword: string;
}

export interface LoginData {
  usernameOrEmail: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: UserPublic;
  tokens: TokenPair;
}

export interface ServiceCommunication {
  getUsers(params: GetUsersParams): Promise<PaginatedResult<UserPublic>>;
  getUserById(userId: number): Promise<UserPublic>;
  createUser(data: CreateUserData): Promise<UserPublic>;
  updateUser(userId: number, data: UpdateUserData): Promise<UserPublic>;
  deleteUser(userId: number): Promise<boolean>;
  changePassword(userId: number, data: ChangePasswordData): Promise<boolean>;
  verifyUser(userId: number): Promise<UserPublic>;
  updateUserStatus(userId: number, status: UserStatus): Promise<UserPublic>;

  login(data: LoginData): Promise<AuthResult>;
  logout(token: string): Promise<boolean>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  validateToken(token: string): Promise<UserPublic>;
  register(data: CreateUserData): Promise<AuthResult>;
  revokeAllTokens(userId: number): Promise<number>;
  getUserTokens(userId: number): Promise<OAuthToken[]>;
}

export interface RepositoryCommunication {
  query<T>(entity: string, params: Record<string, unknown>): Promise<T[]>;
  getById<T>(entity: string, id: number): Promise<T | null>;
  create<T>(entity: string, data: Partial<T>): Promise<T>;
  update<T>(entity: string, id: number, data: Partial<T>): Promise<T>;
  delete(entity: string, id: number): Promise<boolean>;
  count(entity: string, params?: Record<string, unknown>): Promise<number>;
}
