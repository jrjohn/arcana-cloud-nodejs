import axios, { AxiosInstance } from 'axios';
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
import { PaginatedResult } from '../../repositories/interfaces/user.repository.interface.js';
import { delay } from '../../utils/helpers.js';

export class HTTPServiceCommunication implements ServiceCommunication {
  private clients: AxiosInstance[];
  private currentIndex = 0;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(urls: string[]) {
    this.clients = urls.map(url =>
      axios.create({
        baseURL: url,
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }

  private getNextClient(): AxiosInstance {
    const client = this.clients[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.clients.length;
    return client;
  }

  private async executeWithRetry<T>(
    operation: (client: AxiosInstance) => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const client = this.getNextClient();
        return await operation(client);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries - 1) {
          await delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError;
  }

  async getUsers(params: GetUsersParams): Promise<PaginatedResult<UserPublic>> {
    return this.executeWithRetry(async (client) => {
      const response = await client.get('/internal/users', { params });
      return response.data.data;
    });
  }

  async getUserById(userId: number): Promise<UserPublic> {
    return this.executeWithRetry(async (client) => {
      const response = await client.get(`/internal/users/${userId}`);
      return response.data.data;
    });
  }

  async createUser(data: CreateUserData): Promise<UserPublic> {
    return this.executeWithRetry(async (client) => {
      const response = await client.post('/internal/users', data);
      return response.data.data;
    });
  }

  async updateUser(userId: number, data: UpdateUserData): Promise<UserPublic> {
    return this.executeWithRetry(async (client) => {
      const response = await client.put(`/internal/users/${userId}`, data);
      return response.data.data;
    });
  }

  async deleteUser(userId: number): Promise<boolean> {
    return this.executeWithRetry(async (client) => {
      await client.delete(`/internal/users/${userId}`);
      return true;
    });
  }

  async changePassword(userId: number, data: ChangePasswordData): Promise<boolean> {
    return this.executeWithRetry(async (client) => {
      await client.put(`/internal/users/${userId}/password`, data);
      return true;
    });
  }

  async verifyUser(userId: number): Promise<UserPublic> {
    return this.executeWithRetry(async (client) => {
      const response = await client.post(`/internal/users/${userId}/verify`);
      return response.data.data;
    });
  }

  async updateUserStatus(userId: number, status: UserStatus): Promise<UserPublic> {
    return this.executeWithRetry(async (client) => {
      const response = await client.put(`/internal/users/${userId}/status`, { status });
      return response.data.data;
    });
  }

  async login(data: LoginData): Promise<AuthResult> {
    return this.executeWithRetry(async (client) => {
      const response = await client.post('/internal/auth/login', data);
      return response.data.data;
    });
  }

  async logout(token: string): Promise<boolean> {
    return this.executeWithRetry(async (client) => {
      await client.post('/internal/auth/logout', { token });
      return true;
    });
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return this.executeWithRetry(async (client) => {
      const response = await client.post('/internal/auth/refresh', { refreshToken });
      return response.data.data;
    });
  }

  async validateToken(token: string): Promise<UserPublic> {
    return this.executeWithRetry(async (client) => {
      const response = await client.post('/internal/auth/validate', { token });
      return response.data.data;
    });
  }

  async register(data: CreateUserData): Promise<AuthResult> {
    return this.executeWithRetry(async (client) => {
      const response = await client.post('/internal/auth/register', data);
      return response.data.data;
    });
  }

  async revokeAllTokens(userId: number): Promise<number> {
    return this.executeWithRetry(async (client) => {
      const response = await client.post(`/internal/auth/tokens/revoke-all`, { userId });
      return response.data.data.count;
    });
  }

  async getUserTokens(userId: number): Promise<OAuthToken[]> {
    return this.executeWithRetry(async (client) => {
      const response = await client.get(`/internal/auth/tokens/${userId}`);
      return response.data.data;
    });
  }
}

export class HTTPRepositoryCommunication implements RepositoryCommunication {
  private clients: AxiosInstance[];
  private currentIndex = 0;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(urls: string[]) {
    this.clients = urls.map(url =>
      axios.create({
        baseURL: url,
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }

  private getNextClient(): AxiosInstance {
    const client = this.clients[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.clients.length;
    return client;
  }

  private async executeWithRetry<T>(
    operation: (client: AxiosInstance) => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const client = this.getNextClient();
        return await operation(client);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries - 1) {
          await delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError;
  }

  async query<T>(entity: string, params: Record<string, unknown>): Promise<T[]> {
    return this.executeWithRetry(async (client) => {
      const response = await client.get(`/repository/${entity}`, { params });
      return response.data.data;
    });
  }

  async getById<T>(entity: string, id: number): Promise<T | null> {
    return this.executeWithRetry(async (client) => {
      const response = await client.get(`/repository/${entity}/${id}`);
      return response.data.data;
    });
  }

  async create<T>(entity: string, data: Partial<T>): Promise<T> {
    return this.executeWithRetry(async (client) => {
      const response = await client.post(`/repository/${entity}`, data);
      return response.data.data;
    });
  }

  async update<T>(entity: string, id: number, data: Partial<T>): Promise<T> {
    return this.executeWithRetry(async (client) => {
      const response = await client.put(`/repository/${entity}/${id}`, data);
      return response.data.data;
    });
  }

  async delete(entity: string, id: number): Promise<boolean> {
    return this.executeWithRetry(async (client) => {
      await client.delete(`/repository/${entity}/${id}`);
      return true;
    });
  }

  async count(entity: string, params?: Record<string, unknown>): Promise<number> {
    return this.executeWithRetry(async (client) => {
      const response = await client.get(`/repository/${entity}/count`, { params });
      return response.data.data.count;
    });
  }
}
