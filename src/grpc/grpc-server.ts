import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { logger } from '../utils/logger.js';
import { resolve, TOKENS } from '../di/index.js';
import type { IUserRepository } from '../repositories/user.repository.interface.js';
import type { IAuthService } from '../services/auth.service.interface.js';
import type { IUserService } from '../services/user.service.interface.js';
import type { OAuthToken } from '../models/oauth-token.model.js';

const LOADER_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
};

// ---------------------------------------------------------------------------
// Repository gRPC Server
// ---------------------------------------------------------------------------

export function startRepositoryGRPCServer(port: number): grpc.Server {
  const packageDef = protoLoader.loadSync(
    './src/grpc/protos/repository_service.proto',
    LOADER_OPTIONS
  );
  const proto = grpc.loadPackageDefinition(packageDef);
  const server = new grpc.Server();

  server.addService((proto.arcana as any).RepositoryService.service, {
    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        healthy: true,
        message: 'OK',
        timestamp: new Date().toISOString()
      });
    },

    Query: async (call: any, callback: any) => {
      try {
        const { entity, params } = call.request;
        const parsed = JSON.parse(params || '{}');
        const userRepo = resolve<IUserRepository>(TOKENS.UserDao);
        if (entity === 'user') {
          const result = await userRepo.getAll(parsed);
          callback(null, { data: JSON.stringify(result) });
        } else {
          callback(null, { data: JSON.stringify([]) });
        }
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    GetById: async (call: any, callback: any) => {
      try {
        const { entity, id } = call.request;
        const userRepo = resolve<IUserRepository>(TOKENS.UserDao);
        if (entity === 'user') {
          const result = await userRepo.getById(id);
          callback(null, { data: result ? JSON.stringify(result) : '', found: !!result });
        } else {
          callback(null, { data: '', found: false });
        }
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    Create: async (call: any, callback: any) => {
      try {
        const { entity, data } = call.request;
        const parsed = JSON.parse(data || '{}');
        const userRepo = resolve<IUserRepository>(TOKENS.UserDao);
        if (entity === 'user') {
          const result = await userRepo.create(parsed);
          callback(null, { data: JSON.stringify(result) });
        } else {
          callback({ code: grpc.status.UNIMPLEMENTED, message: 'Entity not supported' });
        }
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    Update: async (call: any, callback: any) => {
      try {
        const { entity, id, data } = call.request;
        const parsed = JSON.parse(data || '{}');
        const userRepo = resolve<IUserRepository>(TOKENS.UserDao);
        if (entity === 'user') {
          const result = await userRepo.update(id, parsed);
          callback(null, { data: JSON.stringify(result) });
        } else {
          callback({ code: grpc.status.UNIMPLEMENTED, message: 'Entity not supported' });
        }
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    Delete: async (call: any, callback: any) => {
      try {
        const { entity, id } = call.request;
        const userRepo = resolve<IUserRepository>(TOKENS.UserDao);
        if (entity === 'user') {
          const success = await userRepo.delete(id);
          callback(null, { success });
        } else {
          callback({ code: grpc.status.UNIMPLEMENTED, message: 'Entity not supported' });
        }
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    Count: async (call: any, callback: any) => {
      try {
        const { entity, params } = call.request;
        const parsed = JSON.parse(params || '{}');
        const userRepo = resolve<IUserRepository>(TOKENS.UserDao);
        if (entity === 'user') {
          const count = await userRepo.getCount(parsed);
          callback(null, { count });
        } else {
          callback(null, { count: 0 });
        }
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Repository gRPC server failed to bind', err);
        return;
      }
      logger.info(`Repository gRPC server listening on port ${boundPort}`);
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// Service gRPC Server
// ---------------------------------------------------------------------------

export function startServiceGRPCServer(port: number): grpc.Server {
  const packageDef = protoLoader.loadSync(
    './src/grpc/protos/user_service.proto',
    LOADER_OPTIONS
  );
  const proto = grpc.loadPackageDefinition(packageDef);
  const server = new grpc.Server();

  const transformUser = (u: any) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    first_name: u.firstName || '',
    last_name: u.lastName || '',
    phone: u.phone || '',
    avatar_url: u.avatarUrl || '',
    role: u.role,
    status: u.status,
    is_verified: u.isVerified ?? false,
    is_active: u.isActive ?? true,
    created_at: u.createdAt instanceof Date ? u.createdAt.toISOString() : (u.createdAt || ''),
    updated_at: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : (u.updatedAt || ''),
    last_login_at: u.lastLoginAt instanceof Date ? u.lastLoginAt.toISOString() : (u.lastLoginAt || '')
  });

  const transformToken = (t: OAuthToken) => ({
    id: t.id,
    user_id: t.userId,
    access_token: t.accessToken,
    refresh_token: t.refreshToken,
    token_type: t.tokenType,
    expires_at: t.expiresAt instanceof Date ? t.expiresAt.toISOString() : (t.expiresAt || ''),
    client_name: t.clientName || '',
    ip_address: t.ipAddress || '',
    user_agent: t.userAgent || '',
    is_revoked: t.isRevoked ?? false,
    created_at: t.createdAt instanceof Date ? t.createdAt.toISOString() : (t.createdAt || ''),
    updated_at: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : (t.updatedAt || '')
  });

  server.addService((proto.arcana as any).UserService.service, {
    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        healthy: true,
        message: 'OK',
        timestamp: new Date().toISOString()
      });
    },

    Login: async (call: any, callback: any) => {
      try {
        const authService = resolve<IAuthService>(TOKENS.AuthService);
        const { username_or_email, password, ip_address, user_agent } = call.request;
        const result = await authService.login({
          usernameOrEmail: username_or_email,
          password,
          ipAddress: ip_address,
          userAgent: user_agent
        });
        callback(null, {
          user: transformUser(result.user),
          tokens: {
            access_token: result.tokens.accessToken,
            refresh_token: result.tokens.refreshToken,
            expires_in: result.tokens.expiresIn,
            token_type: result.tokens.tokenType
          }
        });
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    Register: async (call: any, callback: any) => {
      try {
        const authService = resolve<IAuthService>(TOKENS.AuthService);
        const { username, email, password, first_name, last_name } = call.request;
        const result = await authService.register({
          username,
          email,
          password,
          firstName: first_name,
          lastName: last_name
        });
        callback(null, {
          user: transformUser(result.user),
          tokens: {
            access_token: result.tokens.accessToken,
            refresh_token: result.tokens.refreshToken,
            expires_in: result.tokens.expiresIn,
            token_type: result.tokens.tokenType
          }
        });
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    ValidateToken: async (call: any, callback: any) => {
      try {
        const authService = resolve<IAuthService>(TOKENS.AuthService);
        const user = await authService.validateToken(call.request.token);
        callback(null, { user: transformUser(user) });
      } catch (e: any) {
        callback({ code: grpc.status.UNAUTHENTICATED, message: e.message });
      }
    },

    Logout: async (call: any, callback: any) => {
      try {
        const authService = resolve<IAuthService>(TOKENS.AuthService);
        const success = await authService.logout(call.request.token);
        callback(null, { success });
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    GetUsers: async (call: any, callback: any) => {
      try {
        const userService = resolve<IUserService>(TOKENS.UserService);
        const { page, per_page, role, status } = call.request;
        const result = await userService.getUsers({
          page: page || 1,
          perPage: per_page || 20,
          role: role || undefined,
          status: status || undefined
        });
        callback(null, {
          users: result.items.map(transformUser),
          pagination: {
            page: result.pagination.page,
            per_page: result.pagination.perPage,
            total: result.pagination.total,
            total_pages: result.pagination.totalPages
          }
        });
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    GetUserById: async (call: any, callback: any) => {
      try {
        const userService = resolve<IUserService>(TOKENS.UserService);
        const user = await userService.getUserById(call.request.user_id);
        callback(null, transformUser(user));
      } catch (e: any) {
        callback({ code: grpc.status.NOT_FOUND, message: e.message });
      }
    },

    RefreshToken: async (call: any, callback: any) => {
      try {
        const authService = resolve<IAuthService>(TOKENS.AuthService);
        const tokens = await authService.refreshToken(call.request.refresh_token);
        callback(null, {
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          expires_in: tokens.expiresIn,
          token_type: tokens.tokenType
        });
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    RevokeAllTokens: async (call: any, callback: any) => {
      try {
        const authService = resolve<IAuthService>(TOKENS.AuthService);
        const count = await authService.revokeAllTokens(call.request.user_id);
        callback(null, { count });
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    CreateUser: async (call: any, callback: any) => {
      try {
        const userService = resolve<IUserService>(TOKENS.UserService);
        const { username, email, password, first_name, last_name, phone, role } = call.request;
        const user = await userService.createUser({
          username,
          email,
          password,
          firstName: first_name,
          lastName: last_name,
          phone,
          role
        });
        callback(null, transformUser(user));
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    UpdateUser: async (call: any, callback: any) => {
      try {
        const userService = resolve<IUserService>(TOKENS.UserService);
        const { user_id, email, first_name, last_name, phone, avatar_url } = call.request;
        const user = await userService.updateUser(user_id, {
          email,
          firstName: first_name,
          lastName: last_name,
          phone,
          avatarUrl: avatar_url
        });
        callback(null, transformUser(user));
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    DeleteUser: async (call: any, callback: any) => {
      try {
        const userService = resolve<IUserService>(TOKENS.UserService);
        const success = await userService.deleteUser(call.request.user_id);
        callback(null, { success, message: success ? 'Deleted' : 'Not found' });
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    ChangePassword: async (call: any, callback: any) => {
      try {
        const userService = resolve<IUserService>(TOKENS.UserService);
        const success = await userService.changePassword(
          call.request.user_id,
          call.request.old_password,
          call.request.new_password
        );
        callback(null, { success, message: success ? 'Changed' : 'Failed' });
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    VerifyUser: async (call: any, callback: any) => {
      try {
        const userService = resolve<IUserService>(TOKENS.UserService);
        const user = await userService.verifyUser(call.request.user_id);
        callback(null, transformUser(user));
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    UpdateUserStatus: async (call: any, callback: any) => {
      try {
        const userService = resolve<IUserService>(TOKENS.UserService);
        const user = await userService.updateUserStatus(
          call.request.user_id,
          call.request.status
        );
        callback(null, transformUser(user));
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },

    GetUserTokens: async (call: any, callback: any) => {
      try {
        const authService = resolve<IAuthService>(TOKENS.AuthService);
        const tokens = await authService.getUserTokens(call.request.user_id);
        callback(null, { tokens: tokens.map(transformToken) });
      } catch (e: any) {
        callback({ code: grpc.status.INTERNAL, message: e.message });
      }
    },
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Service gRPC server failed to bind', err);
        return;
      }
      logger.info(`Service gRPC server listening on port ${boundPort}`);
    }
  );

  return server;
}
