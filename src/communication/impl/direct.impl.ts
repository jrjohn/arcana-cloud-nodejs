import { injectable, inject } from 'inversify';
import {
  ServiceCommunication,
  RepositoryCommunication,
  GetUsersParams,
  ChangePasswordData,
  LoginData,
  AuthResult
} from '../interfaces.js';
import { UserPublic, CreateUserData, UpdateUserData, UserStatus } from '../../models/user.model.js';
import { TokenPair, OAuthToken } from '../../models/oauth-token.model.js';
import { PaginatedResult } from '../../repositories/user.repository.interface.js';
import { IUserService } from '../../services/user.service.interface.js';
import { IAuthService } from '../../services/auth.service.interface.js';
import { TOKENS } from '../../di/tokens.js';

@injectable()
export class DirectServiceCommunication implements ServiceCommunication {
  constructor(
    @inject(TOKENS.UserService) private userService: IUserService,
    @inject(TOKENS.AuthService) private authService: IAuthService
  ) {}

  async getUsers(params: GetUsersParams): Promise<PaginatedResult<UserPublic>> {
    return this.userService.getUsers(params);
  }

  async getUserById(userId: number): Promise<UserPublic> {
    return this.userService.getUserById(userId);
  }

  async createUser(data: CreateUserData): Promise<UserPublic> {
    return this.userService.createUser(data);
  }

  async updateUser(userId: number, data: UpdateUserData): Promise<UserPublic> {
    return this.userService.updateUser(userId, data);
  }

  async deleteUser(userId: number): Promise<boolean> {
    return this.userService.deleteUser(userId);
  }

  async changePassword(userId: number, data: ChangePasswordData): Promise<boolean> {
    return this.userService.changePassword(userId, data.oldPassword, data.newPassword);
  }

  async verifyUser(userId: number): Promise<UserPublic> {
    return this.userService.verifyUser(userId);
  }

  async updateUserStatus(userId: number, status: UserStatus): Promise<UserPublic> {
    return this.userService.updateUserStatus(userId, status);
  }

  async login(data: LoginData): Promise<AuthResult> {
    return this.authService.login(data);
  }

  async logout(token: string): Promise<boolean> {
    return this.authService.logout(token);
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return this.authService.refreshToken(refreshToken);
  }

  async validateToken(token: string): Promise<UserPublic> {
    return this.authService.validateToken(token);
  }

  async register(data: CreateUserData): Promise<AuthResult> {
    return this.authService.register(data);
  }

  async revokeAllTokens(userId: number): Promise<number> {
    return this.authService.revokeAllTokens(userId);
  }

  async getUserTokens(userId: number): Promise<OAuthToken[]> {
    return this.authService.getUserTokens(userId);
  }
}

@injectable()
export class DirectRepositoryCommunication implements RepositoryCommunication {
  async query<T>(_entity: string, _params: Record<string, unknown>): Promise<T[]> {
    throw new Error('Direct repository communication not fully implemented');
  }

  async getById<T>(_entity: string, _id: number): Promise<T | null> {
    throw new Error('Direct repository communication not fully implemented');
  }

  async create<T>(_entity: string, _data: Partial<T>): Promise<T> {
    throw new Error('Direct repository communication not fully implemented');
  }

  async update<T>(_entity: string, _id: number, _data: Partial<T>): Promise<T> {
    throw new Error('Direct repository communication not fully implemented');
  }

  async delete(_entity: string, _id: number): Promise<boolean> {
    throw new Error('Direct repository communication not fully implemented');
  }

  async count(_entity: string, _params?: Record<string, unknown>): Promise<number> {
    throw new Error('Direct repository communication not fully implemented');
  }
}
