import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { injectable } from 'inversify';
import {
  ServiceCommunication,
  RepositoryCommunication,
  GetUsersParams,
  ChangePasswordData,
  LoginData,
  AuthResult
} from '../interfaces.js';
import { UserPublic, CreateUserData, UpdateUserData, UserStatus, UserRole } from '../../models/user.model.js';
import { TokenPair, OAuthToken } from '../../models/oauth-token.model.js';
import { PaginatedResult } from '../../repositories/user.repository.interface.js';

@injectable()
export class GRPCServiceCommunication implements ServiceCommunication {
  private clients: grpc.Client[];
  private currentIndex = 0;

  constructor(urls: string[]) {
    const packageDefinition = protoLoader.loadSync(
      './src/grpc/protos/user_service.proto',
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const UserService = (protoDescriptor.arcana as Record<string, unknown>).UserService as grpc.ServiceClientConstructor;

    this.clients = urls.map(url =>
      new UserService(url, grpc.credentials.createInsecure())
    );
  }

  private getNextClient(): grpc.Client {
    const client = this.clients[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.clients.length;
    return client;
  }

  private transformUser(grpcUser: Record<string, unknown>): UserPublic {
    return {
      id: grpcUser.id as number,
      username: grpcUser.username as string,
      email: grpcUser.email as string,
      firstName: (grpcUser.first_name as string) || null,
      lastName: (grpcUser.last_name as string) || null,
      phone: (grpcUser.phone as string) || null,
      avatarUrl: (grpcUser.avatar_url as string) || null,
      role: grpcUser.role as UserRole,
      status: grpcUser.status as UserStatus,
      isVerified: grpcUser.is_verified as boolean,
      isActive: grpcUser.is_active as boolean,
      createdAt: new Date(grpcUser.created_at as string),
      updatedAt: new Date(grpcUser.updated_at as string),
      lastLoginAt: grpcUser.last_login_at ? new Date(grpcUser.last_login_at as string) : null
    };
  }

  private transformPaginatedResponse(response: Record<string, unknown>): PaginatedResult<UserPublic> {
    const pagination = response.pagination as Record<string, number>;
    return {
      items: (response.users as Record<string, unknown>[]).map(u => this.transformUser(u)),
      pagination: {
        page: pagination.page,
        perPage: pagination.per_page,
        total: pagination.total,
        totalPages: pagination.total_pages
      }
    };
  }

  async getUsers(params: GetUsersParams): Promise<PaginatedResult<UserPublic>> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.GetUsers(params, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(this.transformPaginatedResponse(response));
      });
    });
  }

  async getUserById(userId: number): Promise<UserPublic> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.GetUserById({ user_id: userId }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(this.transformUser(response));
      });
    });
  }

  async createUser(data: CreateUserData): Promise<UserPublic> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.CreateUser(data, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(this.transformUser(response));
      });
    });
  }

  async updateUser(userId: number, data: UpdateUserData): Promise<UserPublic> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.UpdateUser({ user_id: userId, ...data }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(this.transformUser(response));
      });
    });
  }

  async deleteUser(userId: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.DeleteUser({ user_id: userId }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(response.success as boolean);
      });
    });
  }

  async changePassword(userId: number, data: ChangePasswordData): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.ChangePassword(
        { user_id: userId, old_password: data.oldPassword, new_password: data.newPassword },
        (error: Error | null, response: Record<string, unknown>) => {
          if (error) reject(error);
          else resolve(response.success as boolean);
        }
      );
    });
  }

  async verifyUser(userId: number): Promise<UserPublic> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.VerifyUser({ user_id: userId }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(this.transformUser(response));
      });
    });
  }

  async updateUserStatus(userId: number, status: UserStatus): Promise<UserPublic> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.UpdateUserStatus({ user_id: userId, status }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(this.transformUser(response));
      });
    });
  }

  async login(data: LoginData): Promise<AuthResult> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.Login(data, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else {
          const tokens = response.tokens as Record<string, unknown>;
          resolve({
            user: this.transformUser(response.user as Record<string, unknown>),
            tokens: {
              accessToken: tokens.access_token as string,
              refreshToken: tokens.refresh_token as string,
              expiresIn: tokens.expires_in as number,
              tokenType: tokens.token_type as string
            }
          });
        }
      });
    });
  }

  async logout(token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.Logout({ token }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(response.success as boolean);
      });
    });
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.RefreshToken({ refresh_token: refreshToken }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else {
          resolve({
            accessToken: response.access_token as string,
            refreshToken: response.refresh_token as string,
            expiresIn: response.expires_in as number,
            tokenType: response.token_type as string
          });
        }
      });
    });
  }

  async validateToken(token: string): Promise<UserPublic> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.ValidateToken({ token }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(this.transformUser(response.user as Record<string, unknown>));
      });
    });
  }

  async register(data: CreateUserData): Promise<AuthResult> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.Register(data, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else {
          const tokens = response.tokens as Record<string, unknown>;
          resolve({
            user: this.transformUser(response.user as Record<string, unknown>),
            tokens: {
              accessToken: tokens.access_token as string,
              refreshToken: tokens.refresh_token as string,
              expiresIn: tokens.expires_in as number,
              tokenType: tokens.token_type as string
            }
          });
        }
      });
    });
  }

  async revokeAllTokens(userId: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.RevokeAllTokens({ user_id: userId }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(response.count as number);
      });
    });
  }

  async getUserTokens(userId: number): Promise<OAuthToken[]> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.GetUserTokens({ user_id: userId }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(response.tokens as OAuthToken[]);
      });
    });
  }
}

@injectable()
export class GRPCRepositoryCommunication implements RepositoryCommunication {
  private clients: grpc.Client[];
  private currentIndex = 0;

  constructor(urls: string[]) {
    const packageDefinition = protoLoader.loadSync(
      './src/grpc/protos/repository_service.proto',
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const RepositoryService = (protoDescriptor.arcana as Record<string, unknown>).RepositoryService as grpc.ServiceClientConstructor;

    this.clients = urls.map(url =>
      new RepositoryService(url, grpc.credentials.createInsecure())
    );
  }

  private getNextClient(): grpc.Client {
    const client = this.clients[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.clients.length;
    return client;
  }

  async query<T>(entity: string, params: Record<string, unknown>): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.Query({ entity, params: JSON.stringify(params) }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(JSON.parse(response.data as string));
      });
    });
  }

  async getById<T>(entity: string, id: number): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.GetById({ entity, id }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(response.data ? JSON.parse(response.data as string) : null);
      });
    });
  }

  async create<T>(entity: string, data: Partial<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.Create({ entity, data: JSON.stringify(data) }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(JSON.parse(response.data as string));
      });
    });
  }

  async update<T>(entity: string, id: number, data: Partial<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.Update({ entity, id, data: JSON.stringify(data) }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(JSON.parse(response.data as string));
      });
    });
  }

  async delete(entity: string, id: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.Delete({ entity, id }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(response.success as boolean);
      });
    });
  }

  async count(entity: string, params?: Record<string, unknown>): Promise<number> {
    return new Promise((resolve, reject) => {
      const client = this.getNextClient() as grpc.Client & Record<string, CallableFunction>;
      client.Count({ entity, params: JSON.stringify(params || {}) }, (error: Error | null, response: Record<string, unknown>) => {
        if (error) reject(error);
        else resolve(response.count as number);
      });
    });
  }
}
