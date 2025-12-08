# Arcana Cloud Node.js/TypeScript Enterprise Architecture

## AI Development Prompt

You are an expert Node.js/TypeScript developer specializing in enterprise-grade cloud applications. This document provides comprehensive guidance for developing the Arcana Cloud platform using Node.js 22+ with TypeScript 5.x, following Clean Architecture principles with dual-protocol communication support (HTTP/gRPC).

---

## 1. TECHNOLOGY STACK

### Node.js Native TypeScript Support

Node.js 22+ provides **full native TypeScript support** without transpilation. Reference: https://nodejs.org/api/typescript.html#full-typescript-support

**Key Features:**
- **Type Stripping (Default):** Node.js strips TypeScript types at runtime using `--experimental-strip-types`
- **Full TypeScript Support:** Enable with `--experimental-transform-types` for enums, namespaces, and parameter properties
- **No Build Step Required:** Run `.ts` files directly with `node --experimental-strip-types app.ts`
- **Native Performance:** No transpilation overhead in development

**Enabling Full TypeScript Support:**
```bash
# Run TypeScript directly with type stripping (default)
node --experimental-strip-types src/index.ts

# Enable full TypeScript features (enums, namespaces, decorators)
node --experimental-transform-types src/index.ts

# Set via environment variable
NODE_OPTIONS="--experimental-transform-types" node src/index.ts
```

**Package.json Configuration:**
```json
{
  "type": "module",
  "scripts": {
    "dev": "node --experimental-transform-types --watch src/index.ts",
    "start": "node --experimental-transform-types dist/index.js"
  }
}
```

### Core Technologies
- **Runtime:** Node.js 22+ (LTS) with native TypeScript support
- **Language:** TypeScript 5.x with strict mode (runs natively, no build step required for dev)
- **Web Framework:** Express.js 5.x or Fastify 5.x
- **ORM:** Prisma 6.x or TypeORM 0.3.x
- **Validation:** Zod 3.x
- **gRPC:** @grpc/grpc-js + @grpc/proto-loader
- **Authentication:** jsonwebtoken (JWT HS256)
- **Password Hashing:** bcrypt or argon2
- **Testing:** Vitest or Jest + Supertest
- **Database:** MySQL 8.x / PostgreSQL 16.x
- **Cache:** Redis 7.x (ioredis)
- **Process Manager:** PM2 or Node Cluster

### Development Tools
- **Package Manager:** pnpm or npm
- **Build:** tsx, tsup, or esbuild
- **Linting:** ESLint with @typescript-eslint
- **Formatting:** Prettier
- **Migration:** Prisma Migrate or TypeORM migrations
- **API Documentation:** OpenAPI 3.1 / Swagger

---

## 2. DIRECTORY STRUCTURE

```
/arcana-cloud-nodejs
├── package.json
├── tsconfig.json
├── .env.example
├── .eslintrc.js
├── vitest.config.ts
│
├── /src
│   ├── index.ts                    # Application entry point
│   ├── app.ts                      # Express/Fastify app factory
│   ├── config.ts                   # Configuration management
│   ├── container.ts                # Dependency injection container
│   │
│   ├── /controllers                # HTTP API Layer (Controllers)
│   │   ├── index.ts                # Controller registration
│   │   ├── auth.controller.ts      # Authentication endpoints
│   │   ├── user.controller.ts      # User management endpoints
│   │   └── public.controller.ts    # Public endpoints
│   │
│   ├── /services                   # Business Logic Layer
│   │   ├── /interfaces
│   │   │   ├── auth.service.interface.ts
│   │   │   └── user.service.interface.ts
│   │   ├── /implementations
│   │   │   ├── auth.service.impl.ts
│   │   │   └── user.service.impl.ts
│   │   ├── /routes                 # Internal service HTTP routes
│   │   │   └── internal.routes.ts
│   │   └── /clients                # Service client stubs
│   │       ├── user.service.client.ts
│   │       └── auth.service.client.ts
│   │
│   ├── /repositories               # Data Access Layer
│   │   ├── /interfaces
│   │   │   ├── user.repository.interface.ts
│   │   │   └── oauth-token.repository.interface.ts
│   │   ├── /implementations
│   │   │   ├── user.repository.impl.ts
│   │   │   └── oauth-token.repository.impl.ts
│   │   ├── /routes                 # Internal repository HTTP routes
│   │   │   └── repository.routes.ts
│   │   └── /clients                # Repository client stubs
│   │       └── user.repository.client.ts
│   │
│   ├── /models                     # Domain Models (Prisma/TypeORM)
│   │   ├── index.ts
│   │   ├── user.model.ts
│   │   └── oauth-token.model.ts
│   │
│   ├── /schemas                    # Validation Schemas (Zod)
│   │   ├── auth.schema.ts
│   │   ├── user.schema.ts
│   │   └── common.schema.ts
│   │
│   ├── /communication              # Communication Abstraction Layer
│   │   ├── interfaces.ts           # Communication interfaces & enums
│   │   ├── factory.ts              # Communication factory
│   │   └── /implementations
│   │       ├── direct.impl.ts      # Direct in-process calls
│   │       ├── http.impl.ts        # HTTP/REST implementation
│   │       └── grpc.impl.ts        # gRPC implementation
│   │
│   ├── /grpc                       # gRPC Protocol Buffers
│   │   ├── /protos
│   │   │   ├── common.proto
│   │   │   ├── user_service.proto
│   │   │   └── repository_service.proto
│   │   ├── /generated              # Generated TypeScript from protos
│   │   │   ├── common.ts
│   │   │   ├── user_service.ts
│   │   │   └── repository_service.ts
│   │   └── /servers
│   │       ├── user.grpc.server.ts
│   │       └── repository.grpc.server.ts
│   │
│   ├── /middleware                 # Express/Fastify Middleware
│   │   ├── auth.middleware.ts      # JWT validation
│   │   ├── validation.middleware.ts # Schema validation
│   │   ├── error.middleware.ts     # Global error handler
│   │   └── rate-limit.middleware.ts # Rate limiting
│   │
│   ├── /decorators                 # TypeScript Decorators
│   │   ├── auth.decorators.ts      # @TokenRequired, @RoleRequired
│   │   └── validation.decorators.ts # @ValidateSchema
│   │
│   ├── /utils                      # Shared Utilities
│   │   ├── exceptions.ts           # Custom exception classes
│   │   ├── response.ts             # Standardized response format
│   │   ├── logger.ts               # Structured logging
│   │   └── helpers.ts              # Common helper functions
│   │
│   ├── /types                      # TypeScript Type Definitions
│   │   ├── express.d.ts            # Express type augmentation
│   │   ├── environment.d.ts        # Environment variable types
│   │   └── common.types.ts         # Shared type definitions
│   │
│   └── /tasks                      # Background Tasks (Bull/Agenda)
│       ├── queue.ts                # Queue configuration
│       ├── background.tasks.ts     # Background job handlers
│       └── scheduled.tasks.ts      # Scheduled job handlers
│
├── /prisma                         # Prisma ORM (if using Prisma)
│   ├── schema.prisma               # Database schema
│   └── /migrations                 # Database migrations
│
├── /tests
│   ├── setup.ts                    # Test configuration
│   ├── fixtures.ts                 # Test fixtures
│   ├── /integration
│   │   ├── auth.test.ts
│   │   └── user.test.ts
│   └── /unit
│       ├── /services
│       ├── /repositories
│       └── /utils
│
├── /docker
│   ├── Dockerfile.controller
│   ├── Dockerfile.service
│   ├── Dockerfile.repository
│   └── Dockerfile.monolithic
│
├── /k8s
│   ├── /base
│   ├── /overlays
│   └── kustomization.yaml
│
├── docker-compose.yml
├── docker-compose.layered.yml
└── docker-compose.microservices.yml
```

---

## 3. CLEAN ARCHITECTURE IMPLEMENTATION

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│             CONTROLLER LAYER                             │
│  (HTTP REST API - Express/Fastify)                       │
│  Responsibilities:                                        │
│  - Parse HTTP requests                                   │
│  - Validate input (middleware/decorators)                │
│  - Call service layer via communication abstraction     │
│  - Format responses (standardized format)               │
└────────────────────┬────────────────────────────────────┘
                     │
         Communication Abstraction Layer
         (Factory selects: Direct/HTTP/gRPC)
                     │
         ┌───────────┴────────────┐
         │                        │
┌────────▼──────────────────┐  ┌─▼─────────────────────┐
│    SERVICE LAYER          │  │ COMMUNICATION LAYER   │
│ (Business Logic)          │  │ (Protocol Handler)    │
│ Responsibilities:          │  │                       │
│ - Implement use cases      │  │ Modes:               │
│ - Enforce business rules   │  │ - Direct (monolithic)│
│ - Orchestrate operations   │  │ - HTTP (layered)    │
│ - Handle errors            │  │ - gRPC (layered)    │
│                            │  │ - Microservices     │
└────────┬───────────────────┘  └─────────────────────┘
         │
         │ Communication Abstraction
         │
┌────────▼──────────────────┐
│   REPOSITORY LAYER        │
│  (Data Access)            │
│  Responsibilities:        │
│  - Database operations    │
│  - Query abstraction      │
│  - Transaction management │
│  - Caching coordination   │
└───────────────────────────┘
         │
    ┌────┴────┐
    │          │
┌───▼──┐  ┌───▼──┐
│MySQL │  │Redis │
│      │  │Cache │
└──────┘  └──────┘
```

### Dependency Flow Rules

1. **Controller → Service**: Controllers NEVER access repositories directly
2. **Service → Repository**: Services access data through repository interfaces
3. **No Circular Dependencies**: Flow is unidirectional
4. **Interface Segregation**: Each layer defines interfaces; implementations inject via DI

---

## 4. COMMUNICATION ABSTRACTION LAYER

### Deployment Modes

```typescript
// src/communication/interfaces.ts

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

export interface ServiceCommunication {
  // User operations
  getUsers(params: GetUsersParams): Promise<PaginatedResult<User>>;
  getUserById(userId: number): Promise<User>;
  createUser(data: CreateUserData): Promise<User>;
  updateUser(userId: number, data: UpdateUserData): Promise<User>;
  deleteUser(userId: number): Promise<boolean>;
  changePassword(userId: number, data: ChangePasswordData): Promise<boolean>;
  verifyUser(userId: number): Promise<User>;
  updateUserStatus(userId: number, status: UserStatus): Promise<User>;

  // Auth operations (always local)
  login(data: LoginData): Promise<AuthResult>;
  logout(token: string): Promise<boolean>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  validateToken(token: string): Promise<User>;
}

export interface RepositoryCommunication {
  query<T>(entity: string, params: QueryParams): Promise<T[]>;
  getById<T>(entity: string, id: number): Promise<T | null>;
  create<T>(entity: string, data: Partial<T>): Promise<T>;
  update<T>(entity: string, id: number, data: Partial<T>): Promise<T>;
  delete(entity: string, id: number): Promise<boolean>;
  count(entity: string, params?: CountParams): Promise<number>;
}
```

### Communication Factory

```typescript
// src/communication/factory.ts

import { DeploymentMode, CommunicationProtocol } from './interfaces';
import { DirectServiceCommunication } from './implementations/direct.impl';
import { HTTPServiceCommunication } from './implementations/http.impl';
import { GRPCServiceCommunication } from './implementations/grpc.impl';

export class CommunicationFactory {
  private static serviceInstance: ServiceCommunication | null = null;
  private static repositoryInstance: RepositoryCommunication | null = null;

  static getServiceCommunication(): ServiceCommunication {
    if (this.serviceInstance) return this.serviceInstance;

    const mode = process.env.DEPLOYMENT_MODE as DeploymentMode || DeploymentMode.MONOLITHIC;
    const protocol = process.env.COMMUNICATION_PROTOCOL as CommunicationProtocol || CommunicationProtocol.HTTP;

    switch (mode) {
      case DeploymentMode.MONOLITHIC:
        this.serviceInstance = new DirectServiceCommunication();
        break;
      case DeploymentMode.LAYERED:
      case DeploymentMode.MICROSERVICES:
        if (protocol === CommunicationProtocol.GRPC) {
          this.serviceInstance = new GRPCServiceCommunication(
            process.env.SERVICE_URLS?.split(',') || ['localhost:50051']
          );
        } else {
          this.serviceInstance = new HTTPServiceCommunication(
            process.env.SERVICE_URLS?.split(',') || ['http://localhost:5001']
          );
        }
        break;
    }

    return this.serviceInstance!;
  }

  static getRepositoryCommunication(): RepositoryCommunication {
    if (this.repositoryInstance) return this.repositoryInstance;

    const mode = process.env.DEPLOYMENT_MODE as DeploymentMode || DeploymentMode.MONOLITHIC;
    const protocol = process.env.COMMUNICATION_PROTOCOL as CommunicationProtocol || CommunicationProtocol.HTTP;
    const layer = process.env.DEPLOYMENT_LAYER || 'monolithic';

    // Repository communication only needed in service layer for microservices
    if (mode === DeploymentMode.MONOLITHIC || layer === 'repository') {
      this.repositoryInstance = new DirectRepositoryCommunication();
    } else if (protocol === CommunicationProtocol.GRPC) {
      this.repositoryInstance = new GRPCRepositoryCommunication(
        process.env.REPOSITORY_URLS?.split(',') || ['localhost:50052']
      );
    } else {
      this.repositoryInstance = new HTTPRepositoryCommunication(
        process.env.REPOSITORY_URLS?.split(',') || ['http://localhost:5002']
      );
    }

    return this.repositoryInstance!;
  }
}
```

### HTTP Implementation with Retry Logic

```typescript
// src/communication/implementations/http.impl.ts

import axios, { AxiosInstance, AxiosError } from 'axios';
import { ServiceCommunication, GetUsersParams, User, PaginatedResult } from '../interfaces';

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
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getUsers(params: GetUsersParams): Promise<PaginatedResult<User>> {
    return this.executeWithRetry(async (client) => {
      const response = await client.get('/internal/users', { params });
      return response.data.data;
    });
  }

  async getUserById(userId: number): Promise<User> {
    return this.executeWithRetry(async (client) => {
      const response = await client.get(`/internal/users/${userId}`);
      return response.data.data;
    });
  }

  async createUser(data: CreateUserData): Promise<User> {
    return this.executeWithRetry(async (client) => {
      const response = await client.post('/internal/users', data);
      return response.data.data;
    });
  }

  // ... implement other methods
}
```

### gRPC Implementation

```typescript
// src/communication/implementations/grpc.impl.ts

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { ServiceCommunication, User, PaginatedResult } from '../interfaces';

export class GRPCServiceCommunication implements ServiceCommunication {
  private clients: any[];
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
    const userService = (protoDescriptor.arcana as any).UserService;

    this.clients = urls.map(url =>
      new userService(url, grpc.credentials.createInsecure())
    );
  }

  private getNextClient(): any {
    const client = this.clients[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.clients.length;
    return client;
  }

  async getUsers(params: GetUsersParams): Promise<PaginatedResult<User>> {
    return new Promise((resolve, reject) => {
      this.getNextClient().GetUsers(params, (error: Error, response: any) => {
        if (error) reject(error);
        else resolve(this.transformPaginatedResponse(response));
      });
    });
  }

  async getUserById(userId: number): Promise<User> {
    return new Promise((resolve, reject) => {
      this.getNextClient().GetUserById({ user_id: userId }, (error: Error, response: any) => {
        if (error) reject(error);
        else resolve(this.transformUser(response));
      });
    });
  }

  private transformUser(grpcUser: any): User {
    return {
      id: grpcUser.id,
      username: grpcUser.username,
      email: grpcUser.email,
      firstName: grpcUser.first_name,
      lastName: grpcUser.last_name,
      role: grpcUser.role,
      status: grpcUser.status,
      isVerified: grpcUser.is_verified,
      isActive: grpcUser.is_active,
      createdAt: new Date(grpcUser.created_at),
      updatedAt: new Date(grpcUser.updated_at)
    };
  }

  // ... implement other methods
}
```

---

## 5. API ENDPOINTS

### Authentication Endpoints (`/api/v1/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | User registration |
| POST | `/login` | No | User login (returns tokens) |
| POST | `/logout` | Yes | Logout (revoke token) |
| POST | `/refresh` | No | Refresh access token |
| GET | `/me` | Yes | Get current user info |
| GET | `/tokens` | Yes | List user's valid tokens |
| POST | `/tokens/revoke-all` | Yes | Revoke all user tokens |

### User Management Endpoints (`/api/v1/users`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | Yes | ADMIN | Get paginated user list |
| GET | `/:userId` | Yes | - | Get user by ID |
| POST | `/` | Yes | ADMIN | Create user |
| PUT | `/:userId` | Yes | - | Update user |
| DELETE | `/:userId` | Yes | ADMIN | Delete user |
| PUT | `/:userId/password` | Yes | - | Change password |
| POST | `/:userId/verify` | Yes | ADMIN | Verify user |
| PUT | `/:userId/status` | Yes | ADMIN | Update user status |

### Controller Implementation

```typescript
// src/controllers/auth.controller.ts

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateSchema } from '../middleware/validation.middleware';
import { tokenRequired } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../utils/response';
import { CommunicationFactory } from '../communication/factory';
import { LoginSchema, RegisterSchema, RefreshTokenSchema } from '../schemas/auth.schema';

const router = Router();
const service = CommunicationFactory.getServiceCommunication();

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post('/register',
  validateSchema(RegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.register(req.body);
      return res.status(201).json(
        successResponse(result, 'User registered successfully')
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Authenticate user and return tokens
 */
router.post('/login',
  validateSchema(LoginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { usernameOrEmail, password } = req.body;
      const result = await service.login({
        usernameOrEmail,
        password,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.json(successResponse(result, 'Login successful'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/logout
 * Revoke current access token
 */
router.post('/logout',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      await service.logout(token!);
      return res.json(successResponse(null, 'Logout successful'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
  validateSchema(RefreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const tokens = await service.refreshToken(refreshToken);
      return res.json(successResponse(tokens, 'Token refreshed successfully'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/auth/me
 * Get current authenticated user
 */
router.get('/me',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return res.json(successResponse(req.user, 'User retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/auth/tokens
 * List all valid tokens for current user
 */
router.get('/tokens',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await service.getUserTokens(req.user!.id);
      return res.json(successResponse(tokens, 'Tokens retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/tokens/revoke-all
 * Revoke all tokens for current user
 */
router.post('/tokens/revoke-all',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await service.revokeAllTokens(req.user!.id);
      return res.json(successResponse({ revokedCount: count }, 'All tokens revoked'));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

```typescript
// src/controllers/user.controller.ts

import { Router, Request, Response, NextFunction } from 'express';
import { tokenRequired, roleRequired } from '../middleware/auth.middleware';
import { validateSchema, validatePagination } from '../middleware/validation.middleware';
import { successResponse, paginatedResponse } from '../utils/response';
import { CommunicationFactory } from '../communication/factory';
import { UserRole } from '../models/user.model';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ChangePasswordSchema,
  UpdateStatusSchema
} from '../schemas/user.schema';

const router = Router();
const service = CommunicationFactory.getServiceCommunication();

/**
 * GET /api/v1/users
 * Get paginated list of users (Admin only)
 */
router.get('/',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  validatePagination({ maxPerPage: 100 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage, role, status } = req.query;
      const result = await service.getUsers({
        page: Number(page) || 1,
        perPage: Number(perPage) || 20,
        role: role as UserRole,
        status: status as UserStatus
      });
      return res.json(paginatedResponse(result.items, result.pagination));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/users/:userId
 * Get user by ID
 */
router.get('/:userId',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);

      // Users can only view their own profile unless admin
      if (req.user!.role !== UserRole.ADMIN && req.user!.id !== userId) {
        throw new AuthorizationError('Not authorized to view this user');
      }

      const user = await service.getUserById(userId);
      return res.json(successResponse(user, 'User retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/users
 * Create a new user (Admin only)
 */
router.post('/',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  validateSchema(CreateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await service.createUser(req.body);
      return res.status(201).json(successResponse(user, 'User created successfully'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/users/:userId
 * Update user
 */
router.put('/:userId',
  tokenRequired,
  validateSchema(UpdateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);

      // Users can only update their own profile unless admin
      if (req.user!.role !== UserRole.ADMIN && req.user!.id !== userId) {
        throw new AuthorizationError('Not authorized to update this user');
      }

      const user = await service.updateUser(userId, req.body);
      return res.json(successResponse(user, 'User updated successfully'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/users/:userId
 * Delete user (Admin only)
 */
router.delete('/:userId',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);
      await service.deleteUser(userId);
      return res.json(successResponse(null, 'User deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/users/:userId/password
 * Change user password
 */
router.put('/:userId/password',
  tokenRequired,
  validateSchema(ChangePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);

      // Users can only change their own password
      if (req.user!.id !== userId) {
        throw new AuthorizationError('Not authorized to change this password');
      }

      await service.changePassword(userId, req.body);
      return res.json(successResponse(null, 'Password changed successfully'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/users/:userId/verify
 * Verify user (Admin only)
 */
router.post('/:userId/verify',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await service.verifyUser(userId);
      return res.json(successResponse(user, 'User verified successfully'));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/users/:userId/status
 * Update user status (Admin only)
 */
router.put('/:userId/status',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  validateSchema(UpdateStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);
      const { status } = req.body;
      const user = await service.updateUserStatus(userId, status);
      return res.json(successResponse(user, 'User status updated successfully'));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

---

## 6. VALIDATION SCHEMAS (Zod)

```typescript
// src/schemas/auth.schema.ts

import { z } from 'zod';

// Password must be at least 8 characters with uppercase, lowercase, number, and special char
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const RegisterSchema = z.object({
  body: z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be at most 50 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    password: passwordSchema,
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional()
  })
});

export const LoginSchema = z.object({
  body: z.object({
    usernameOrEmail: z.string().min(1, 'Username or email is required'),
    password: z.string().min(1, 'Password is required')
  })
});

export const RefreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required')
  })
});

export type RegisterInput = z.infer<typeof RegisterSchema>['body'];
export type LoginInput = z.infer<typeof LoginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>['body'];
```

```typescript
// src/schemas/user.schema.ts

import { z } from 'zod';
import { UserRole, UserStatus } from '../models/user.model';

export const CreateUserSchema = z.object({
  body: z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be at most 50 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    phone: z.string().max(20).optional(),
    role: z.nativeEnum(UserRole).optional().default(UserRole.USER)
  })
});

export const UpdateUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').optional(),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    phone: z.string().max(20).optional(),
    avatarUrl: z.string().url('Invalid URL').optional()
  })
});

export const ChangePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
  })
});

export const UpdateStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(UserStatus)
  })
});

export const PaginationSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    perPage: z.string().regex(/^\d+$/).transform(Number).default('20'),
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(UserStatus).optional()
  })
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>['body'];
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>['body'];
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>['body'];
```

---

## 7. DOMAIN MODELS

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  USER
  GUEST
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  DELETED
}

model User {
  id            Int         @id @default(autoincrement())
  username      String      @unique @db.VarChar(50)
  email         String      @unique @db.VarChar(255)
  passwordHash  String      @map("password_hash") @db.VarChar(255)
  firstName     String?     @map("first_name") @db.VarChar(50)
  lastName      String?     @map("last_name") @db.VarChar(50)
  phone         String?     @db.VarChar(20)
  avatarUrl     String?     @map("avatar_url") @db.VarChar(500)
  role          UserRole    @default(USER)
  status        UserStatus  @default(ACTIVE)
  isVerified    Boolean     @default(false) @map("is_verified")
  isActive      Boolean     @default(true) @map("is_active")
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  lastLoginAt   DateTime?   @map("last_login_at")

  oauthTokens   OAuthToken[]

  @@map("users")
  @@index([email])
  @@index([username])
  @@index([role, status])
}

model OAuthToken {
  id            Int       @id @default(autoincrement())
  userId        Int       @map("user_id")
  accessToken   String    @map("access_token") @db.Text
  refreshToken  String    @map("refresh_token") @db.Text
  tokenType     String    @default("Bearer") @map("token_type") @db.VarChar(50)
  expiresAt     DateTime  @map("expires_at")
  clientName    String?   @map("client_name") @db.VarChar(100)
  ipAddress     String?   @map("ip_address") @db.VarChar(45)
  userAgent     String?   @map("user_agent") @db.VarChar(500)
  isRevoked     Boolean   @default(false) @map("is_revoked")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("oauth_tokens")
  @@index([userId])
  @@index([accessToken(length: 255)])
  @@index([refreshToken(length: 255)])
}
```

### TypeScript Model Types

```typescript
// src/models/user.model.ts

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUEST = 'GUEST'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED'
}

export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash?: string;  // Excluded from responses
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface UserPublic extends Omit<User, 'passwordHash'> {}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
}
```

```typescript
// src/models/oauth-token.model.ts

export interface OAuthToken {
  id: number;
  userId: number;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: Date;
  clientName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}
```

---

## 8. REPOSITORY LAYER

```typescript
// src/repositories/interfaces/user.repository.interface.ts

import { User, CreateUserData, UpdateUserData, UserRole, UserStatus } from '../../models/user.model';

export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface UserFilterParams extends PaginationParams {
  role?: UserRole;
  status?: UserStatus;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface IUserRepository {
  create(data: CreateUserData & { passwordHash: string }): Promise<User>;
  getById(id: number): Promise<User | null>;
  getByUsername(username: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  update(id: number, data: UpdateUserData): Promise<User>;
  delete(id: number): Promise<boolean>;
  getAll(params: UserFilterParams): Promise<PaginatedResult<User>>;
  getCount(params?: Partial<UserFilterParams>): Promise<number>;
  updateLastLogin(id: number): Promise<void>;
}
```

```typescript
// src/repositories/implementations/user.repository.impl.ts

import { PrismaClient } from '@prisma/client';
import {
  IUserRepository,
  UserFilterParams,
  PaginatedResult
} from '../interfaces/user.repository.interface';
import { User, CreateUserData, UpdateUserData, UserRole, UserStatus } from '../../models/user.model';

export class UserRepositoryImpl implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateUserData & { passwordHash: string }): Promise<User> {
    const { password, ...userData } = data as any;
    return this.prisma.user.create({
      data: {
        ...userData,
        passwordHash: data.passwordHash
      }
    });
  }

  async getById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id }
    });
  }

  async getByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username }
    });
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email }
    });
  }

  async update(id: number, data: UpdateUserData): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data
    });
  }

  async delete(id: number): Promise<boolean> {
    await this.prisma.user.delete({
      where: { id }
    });
    return true;
  }

  async getAll(params: UserFilterParams): Promise<PaginatedResult<User>> {
    const { page, perPage, role, status } = params;
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      items,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  async getCount(params?: Partial<UserFilterParams>): Promise<number> {
    const where: any = {};
    if (params?.role) where.role = params.role;
    if (params?.status) where.status = params.status;

    return this.prisma.user.count({ where });
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() }
    });
  }
}
```

---

## 9. SERVICE LAYER

```typescript
// src/services/interfaces/user.service.interface.ts

import {
  User,
  UserPublic,
  CreateUserData,
  UpdateUserData,
  UserStatus
} from '../../models/user.model';
import { PaginatedResult, UserFilterParams } from '../../repositories/interfaces/user.repository.interface';

export interface IUserService {
  createUser(data: CreateUserData): Promise<UserPublic>;
  getUserById(id: number): Promise<UserPublic>;
  getUserByUsername(username: string): Promise<UserPublic>;
  getUserByEmail(email: string): Promise<UserPublic>;
  updateUser(id: number, data: UpdateUserData): Promise<UserPublic>;
  deleteUser(id: number): Promise<boolean>;
  changePassword(id: number, oldPassword: string, newPassword: string): Promise<boolean>;
  verifyUser(id: number): Promise<UserPublic>;
  updateUserStatus(id: number, status: UserStatus): Promise<UserPublic>;
  getUsers(params: UserFilterParams): Promise<PaginatedResult<UserPublic>>;
}
```

```typescript
// src/services/implementations/user.service.impl.ts

import bcrypt from 'bcrypt';
import { IUserService } from '../interfaces/user.service.interface';
import { IUserRepository, UserFilterParams, PaginatedResult } from '../../repositories/interfaces/user.repository.interface';
import { User, UserPublic, CreateUserData, UpdateUserData, UserStatus } from '../../models/user.model';
import { NotFoundError, ConflictError, ValidationError, AuthenticationError } from '../../utils/exceptions';

export class UserServiceImpl implements IUserService {
  private readonly SALT_ROUNDS = 12;

  constructor(private userRepository: IUserRepository) {}

  private excludePassword(user: User): UserPublic {
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }

  async createUser(data: CreateUserData): Promise<UserPublic> {
    // Check for existing username
    const existingUsername = await this.userRepository.getByUsername(data.username);
    if (existingUsername) {
      throw new ConflictError('Username already exists');
    }

    // Check for existing email
    const existingEmail = await this.userRepository.getByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    // Create user
    const user = await this.userRepository.create({
      ...data,
      passwordHash
    });

    return this.excludePassword(user);
  }

  async getUserById(id: number): Promise<UserPublic> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.excludePassword(user);
  }

  async getUserByUsername(username: string): Promise<UserPublic> {
    const user = await this.userRepository.getByUsername(username);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.excludePassword(user);
  }

  async getUserByEmail(email: string): Promise<UserPublic> {
    const user = await this.userRepository.getByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.excludePassword(user);
  }

  async updateUser(id: number, data: UpdateUserData): Promise<UserPublic> {
    // Check if user exists
    const existingUser = await this.userRepository.getById(id);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Check if email is being changed and already exists
    if (data.email && data.email !== existingUser.email) {
      const existingEmail = await this.userRepository.getByEmail(data.email);
      if (existingEmail) {
        throw new ConflictError('Email already exists');
      }
    }

    const updatedUser = await this.userRepository.update(id, data);
    return this.excludePassword(updatedUser);
  }

  async deleteUser(id: number): Promise<boolean> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.userRepository.delete(id);
  }

  async changePassword(id: number, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, user.passwordHash!);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.userRepository.update(id, { passwordHash } as any);

    return true;
  }

  async verifyUser(id: number): Promise<UserPublic> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.isVerified) {
      throw new ConflictError('User is already verified');
    }

    const updatedUser = await this.userRepository.update(id, { isVerified: true } as any);
    return this.excludePassword(updatedUser);
  }

  async updateUserStatus(id: number, status: UserStatus): Promise<UserPublic> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updatedUser = await this.userRepository.update(id, { status } as any);
    return this.excludePassword(updatedUser);
  }

  async getUsers(params: UserFilterParams): Promise<PaginatedResult<UserPublic>> {
    const result = await this.userRepository.getAll(params);
    return {
      items: result.items.map(user => this.excludePassword(user)),
      pagination: result.pagination
    };
  }
}
```

```typescript
// src/services/interfaces/auth.service.interface.ts

import { User, UserPublic, CreateUserData } from '../../models/user.model';
import { OAuthToken, TokenPair } from '../../models/oauth-token.model';

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

export interface IAuthService {
  login(data: LoginData): Promise<AuthResult>;
  logout(accessToken: string): Promise<boolean>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  validateToken(accessToken: string): Promise<UserPublic>;
  register(data: CreateUserData): Promise<AuthResult>;
  verifyPassword(user: User, password: string): Promise<boolean>;
  revokeAllTokens(userId: number): Promise<number>;
  getUserTokens(userId: number): Promise<OAuthToken[]>;
}
```

```typescript
// src/services/implementations/auth.service.impl.ts

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { IAuthService, LoginData, AuthResult } from '../interfaces/auth.service.interface';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface';
import { IOAuthTokenRepository } from '../../repositories/interfaces/oauth-token.repository.interface';
import { User, UserPublic, CreateUserData, UserStatus } from '../../models/user.model';
import { OAuthToken, TokenPair } from '../../models/oauth-token.model';
import { AuthenticationError, NotFoundError, ConflictError } from '../../utils/exceptions';
import { config } from '../../config';

interface JWTPayload {
  userId: number;
  username: string;
  email: string;
  role: string;
  tokenType: 'access' | 'refresh';
  jti: string;
  iat: number;
  exp: number;
}

export class AuthServiceImpl implements IAuthService {
  private readonly SALT_ROUNDS = 12;

  constructor(
    private userRepository: IUserRepository,
    private tokenRepository: IOAuthTokenRepository
  ) {}

  private excludePassword(user: User): UserPublic {
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }

  private generateTokenPair(user: User): TokenPair {
    const jti = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    const accessTokenPayload: Partial<JWTPayload> = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tokenType: 'access',
      jti
    };

    const refreshTokenPayload: Partial<JWTPayload> = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tokenType: 'refresh',
      jti
    };

    const accessToken = jwt.sign(accessTokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiresIn
    });

    const refreshToken = jwt.sign(refreshTokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.accessExpiresInSeconds,
      tokenType: 'Bearer'
    };
  }

  async login(data: LoginData): Promise<AuthResult> {
    const { usernameOrEmail, password, ipAddress, userAgent } = data;

    // Find user by username or email
    let user = await this.userRepository.getByUsername(usernameOrEmail);
    if (!user) {
      user = await this.userRepository.getByEmail(usernameOrEmail);
    }

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Check user status
    if (user.status !== UserStatus.ACTIVE) {
      throw new AuthenticationError('Account is not active');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash!);
    if (!isValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Generate tokens
    const tokens = this.generateTokenPair(user);

    // Store token in database
    const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInSeconds * 1000);
    await this.tokenRepository.create({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      ipAddress,
      userAgent
    });

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    return {
      user: this.excludePassword(user),
      tokens
    };
  }

  async logout(accessToken: string): Promise<boolean> {
    const token = await this.tokenRepository.getByAccessToken(accessToken);
    if (!token) {
      return true; // Already logged out
    }

    await this.tokenRepository.revoke(token.id);
    return true;
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    let payload: JWTPayload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.secret) as JWTPayload;
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }

    // Check if token is revoked
    const storedToken = await this.tokenRepository.getByRefreshToken(refreshToken);
    if (!storedToken || storedToken.isRevoked) {
      throw new AuthenticationError('Token has been revoked');
    }

    // Get user
    const user = await this.userRepository.getById(payload.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Revoke old token
    await this.tokenRepository.revoke(storedToken.id);

    // Generate new tokens
    const tokens = this.generateTokenPair(user);

    // Store new token
    const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInSeconds * 1000);
    await this.tokenRepository.create({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      ipAddress: storedToken.ipAddress,
      userAgent: storedToken.userAgent
    });

    return tokens;
  }

  async validateToken(accessToken: string): Promise<UserPublic> {
    let payload: JWTPayload;
    try {
      payload = jwt.verify(accessToken, config.jwt.secret) as JWTPayload;
    } catch (error) {
      throw new AuthenticationError('Invalid access token');
    }

    if (payload.tokenType !== 'access') {
      throw new AuthenticationError('Invalid token type');
    }

    // Check if token is revoked
    const storedToken = await this.tokenRepository.getByAccessToken(accessToken);
    if (storedToken?.isRevoked) {
      throw new AuthenticationError('Token has been revoked');
    }

    // Get user
    const user = await this.userRepository.getById(payload.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    return this.excludePassword(user);
  }

  async register(data: CreateUserData): Promise<AuthResult> {
    // Check for existing username
    const existingUsername = await this.userRepository.getByUsername(data.username);
    if (existingUsername) {
      throw new ConflictError('Username already exists');
    }

    // Check for existing email
    const existingEmail = await this.userRepository.getByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    // Create user
    const user = await this.userRepository.create({
      ...data,
      passwordHash
    });

    // Generate tokens
    const tokens = this.generateTokenPair(user);

    // Store token
    const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInSeconds * 1000);
    await this.tokenRepository.create({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt
    });

    return {
      user: this.excludePassword(user),
      tokens
    };
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash!);
  }

  async revokeAllTokens(userId: number): Promise<number> {
    return this.tokenRepository.revokeAllForUser(userId);
  }

  async getUserTokens(userId: number): Promise<OAuthToken[]> {
    return this.tokenRepository.getActiveForUser(userId);
  }
}
```

---

## 10. MIDDLEWARE

```typescript
// src/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { container } from '../container';
import { AuthenticationError, AuthorizationError } from '../utils/exceptions';
import { UserRole } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export const tokenRequired = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    const authService = container.get('authService');
    const user = await authService.validateToken(token);

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const roleRequired = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AuthorizationError('Insufficient permissions'));
      return;
    }

    next();
  };
};
```

```typescript
// src/middleware/validation.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../utils/exceptions';

export const validateSchema = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string> = {};
        error.errors.forEach(err => {
          const path = err.path.slice(1).join('.');
          details[path] = err.message;
        });
        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
};

export const validatePagination = (options: { maxPerPage?: number } = {}) => {
  const { maxPerPage = 100 } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    let page = parseInt(req.query.page as string) || 1;
    let perPage = parseInt(req.query.perPage as string) || 20;

    if (page < 1) page = 1;
    if (perPage < 1) perPage = 1;
    if (perPage > maxPerPage) perPage = maxPerPage;

    req.query.page = String(page);
    req.query.perPage = String(perPage);

    next();
  };
};
```

```typescript
// src/middleware/error.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { APIException, ValidationError as AppValidationError } from '../utils/exceptions';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.headers['x-request-id']
  });

  // Handle known API exceptions
  if (err instanceof APIException) {
    res.status(err.statusCode).json(
      errorResponse(err.message, err.statusCode, err.errorCode, err.details)
    );
    return;
  }

  // Handle unknown errors
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json(
    errorResponse(
      isDev ? err.message : 'Internal server error',
      500,
      'INTERNAL_ERROR',
      isDev ? { stack: err.stack } : undefined
    )
  );
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json(
    errorResponse('Resource not found', 404, 'NOT_FOUND')
  );
};
```

---

## 11. UTILITIES

```typescript
// src/utils/exceptions.ts

export class APIException extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public errorCode: string = 'INTERNAL_ERROR',
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends APIException {
  constructor(message: string = 'Validation failed', details?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends APIException {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends APIException {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends APIException {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends APIException {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}
```

```typescript
// src/utils/response.ts

import { v4 as uuidv4 } from 'uuid';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  timestamp: string;
  requestId: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
  requestId: string;
}

export interface PaginatedResponse<T> {
  success: true;
  items: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
  requestId: string;
}

export function successResponse<T>(
  data: T,
  message: string = 'Success'
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId: uuidv4()
  };
}

export function errorResponse(
  message: string,
  statusCode: number = 500,
  code: string = 'INTERNAL_ERROR',
  details?: Record<string, any>
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString(),
    requestId: uuidv4()
  };
}

export function paginatedResponse<T>(
  items: T[],
  pagination: { page: number; perPage: number; total: number; totalPages: number }
): PaginatedResponse<T> {
  return {
    success: true,
    items,
    pagination,
    timestamp: new Date().toISOString(),
    requestId: uuidv4()
  };
}
```

```typescript
// src/utils/logger.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`
});
```

---

## 12. DEPENDENCY INJECTION

```typescript
// src/container.ts

import { PrismaClient } from '@prisma/client';
import { UserRepositoryImpl } from './repositories/implementations/user.repository.impl';
import { OAuthTokenRepositoryImpl } from './repositories/implementations/oauth-token.repository.impl';
import { UserServiceImpl } from './services/implementations/user.service.impl';
import { AuthServiceImpl } from './services/implementations/auth.service.impl';
import { CommunicationFactory } from './communication/factory';

type Factory<T> = () => T;

interface Registration<T> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

class DIContainer {
  private registrations = new Map<string, Registration<any>>();

  registerSingleton<T>(name: string, factory: Factory<T>): void {
    this.registrations.set(name, { factory, singleton: true });
  }

  registerTransient<T>(name: string, factory: Factory<T>): void {
    this.registrations.set(name, { factory, singleton: false });
  }

  registerInstance<T>(name: string, instance: T): void {
    this.registrations.set(name, {
      factory: () => instance,
      singleton: true,
      instance
    });
  }

  get<T>(name: string): T {
    const registration = this.registrations.get(name);
    if (!registration) {
      throw new Error(`Dependency not registered: ${name}`);
    }

    if (registration.singleton) {
      if (!registration.instance) {
        registration.instance = registration.factory();
      }
      return registration.instance;
    }

    return registration.factory();
  }
}

export const container = new DIContainer();

export function initializeDependencies(): void {
  // Database
  const prisma = new PrismaClient();
  container.registerInstance('prisma', prisma);

  // Repositories
  container.registerSingleton('userRepository', () =>
    new UserRepositoryImpl(container.get('prisma'))
  );
  container.registerSingleton('oauthTokenRepository', () =>
    new OAuthTokenRepositoryImpl(container.get('prisma'))
  );

  // Services
  container.registerSingleton('userService', () =>
    new UserServiceImpl(container.get('userRepository'))
  );
  container.registerSingleton('authService', () =>
    new AuthServiceImpl(
      container.get('userRepository'),
      container.get('oauthTokenRepository')
    )
  );

  // Communication
  container.registerSingleton('serviceCommunication', () =>
    CommunicationFactory.getServiceCommunication()
  );
  container.registerSingleton('repositoryCommunication', () =>
    CommunicationFactory.getRepositoryCommunication()
  );
}
```

---

## 13. CONFIGURATION

```typescript
// src/config.ts

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  // Server
  port: z.number().default(3000),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'testing', 'production']).default('development'),

  // Database
  databaseUrl: z.string(),

  // Redis
  redisUrl: z.string().optional(),

  // JWT
  jwt: z.object({
    secret: z.string().min(32),
    accessExpiresIn: z.string().default('1h'),
    accessExpiresInSeconds: z.number().default(3600),
    refreshExpiresIn: z.string().default('30d'),
    refreshExpiresInSeconds: z.number().default(2592000)
  }),

  // Deployment
  deploymentMode: z.enum(['monolithic', 'layered', 'microservices']).default('monolithic'),
  deploymentLayer: z.enum(['monolithic', 'controller', 'service', 'repository']).default('monolithic'),
  communicationProtocol: z.enum(['direct', 'http', 'grpc']).default('http'),
  serviceUrls: z.array(z.string()).default(['http://localhost:5001']),
  repositoryUrls: z.array(z.string()).default(['http://localhost:5002']),

  // Rate Limiting
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    windowMs: z.number().default(3600000), // 1 hour
    max: z.number().default(100)
  }),

  // CORS
  corsOrigins: z.array(z.string()).default(['http://localhost:3000'])
});

function loadConfig() {
  const env = process.env;

  const rawConfig = {
    port: parseInt(env.PORT || '3000'),
    host: env.HOST || '0.0.0.0',
    nodeEnv: env.NODE_ENV || 'development',
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    jwt: {
      secret: env.JWT_SECRET || (env.NODE_ENV === 'development' ? 'dev-secret-key-min-32-characters!' : undefined),
      accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN || '1h',
      accessExpiresInSeconds: parseInt(env.JWT_ACCESS_EXPIRES_IN_SECONDS || '3600'),
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN || '30d',
      refreshExpiresInSeconds: parseInt(env.JWT_REFRESH_EXPIRES_IN_SECONDS || '2592000')
    },
    deploymentMode: env.DEPLOYMENT_MODE || 'monolithic',
    deploymentLayer: env.DEPLOYMENT_LAYER || 'monolithic',
    communicationProtocol: env.COMMUNICATION_PROTOCOL || 'http',
    serviceUrls: env.SERVICE_URLS?.split(',') || ['http://localhost:5001'],
    repositoryUrls: env.REPOSITORY_URLS?.split(',') || ['http://localhost:5002'],
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED !== 'false',
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || '3600000'),
      max: parseInt(env.RATE_LIMIT_MAX || '100')
    },
    corsOrigins: env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
  };

  const result = ConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }

  // Production checks
  if (result.data.nodeEnv === 'production') {
    if (!env.JWT_SECRET) {
      console.error('JWT_SECRET must be set in production');
      process.exit(1);
    }
    if (result.data.jwt.secret.length < 64) {
      console.error('JWT_SECRET must be at least 64 characters in production');
      process.exit(1);
    }
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof ConfigSchema>;
```

---

## 14. APPLICATION ENTRY POINT

```typescript
// src/app.ts

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { initializeDependencies } from './container';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestIdMiddleware, requestLoggerMiddleware } from './middleware/request.middleware';
import authController from './controllers/auth.controller';
import userController from './controllers/user.controller';
import publicController from './controllers/public.controller';
import healthController from './controllers/health.controller';

export function createApp(): Express {
  const app = express();

  // Initialize dependencies
  initializeDependencies();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true
  }));

  // Parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // Request tracking
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Rate limiting
  if (config.rateLimit.enabled) {
    app.use(rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false
    }));
  }

  // Health checks
  app.use('/health', healthController);
  app.use('/ready', healthController);

  // API routes
  app.use('/api/v1/auth', authController);
  app.use('/api/v1/users', userController);
  app.use('/public', publicController);

  // Internal routes (for layered/microservices mode)
  if (config.deploymentLayer === 'service' || config.deploymentLayer === 'monolithic') {
    // Register internal service routes
    const internalRoutes = require('./services/routes/internal.routes').default;
    app.use('/internal', internalRoutes);
  }

  if (config.deploymentLayer === 'repository' || config.deploymentLayer === 'monolithic') {
    // Register internal repository routes
    const repositoryRoutes = require('./repositories/routes/repository.routes').default;
    app.use('/repository', repositoryRoutes);
  }

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
```

```typescript
// src/index.ts

import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { startGRPCServer } from './grpc/servers';

async function main() {
  const app = createApp();

  // Start HTTP server
  const httpServer = app.listen(config.port, config.host, () => {
    logger.info(`HTTP server started on ${config.host}:${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Deployment mode: ${config.deploymentMode}`);
    logger.info(`Deployment layer: ${config.deploymentLayer}`);
    logger.info(`Communication protocol: ${config.communicationProtocol}`);
  });

  // Start gRPC server if needed
  if (config.communicationProtocol === 'grpc') {
    const grpcPort = config.port + 40000; // e.g., 3000 -> 43000
    await startGRPCServer(grpcPort);
    logger.info(`gRPC server started on port ${grpcPort}`);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);

    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Force shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
```

---

## 15. gRPC PROTOBUF DEFINITIONS

```protobuf
// src/grpc/protos/common.proto

syntax = "proto3";

package arcana;

message Empty {}

message HealthCheckResponse {
  bool healthy = 1;
  string message = 2;
  string timestamp = 3;
}

enum UserRole {
  USER_ROLE_UNSPECIFIED = 0;
  USER_ROLE_ADMIN = 1;
  USER_ROLE_USER = 2;
  USER_ROLE_GUEST = 3;
}

enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;
  USER_STATUS_ACTIVE = 1;
  USER_STATUS_INACTIVE = 2;
  USER_STATUS_SUSPENDED = 3;
  USER_STATUS_DELETED = 4;
}

message User {
  int32 id = 1;
  string username = 2;
  string email = 3;
  string first_name = 4;
  string last_name = 5;
  string phone = 6;
  string avatar_url = 7;
  UserRole role = 8;
  UserStatus status = 9;
  bool is_verified = 10;
  bool is_active = 11;
  string created_at = 12;
  string updated_at = 13;
  string last_login_at = 14;
}

message Pagination {
  int32 page = 1;
  int32 per_page = 2;
  int32 total = 3;
  int32 total_pages = 4;
}
```

```protobuf
// src/grpc/protos/user_service.proto

syntax = "proto3";

package arcana;

import "common.proto";

service UserService {
  rpc GetUsers(GetUsersRequest) returns (GetUsersResponse);
  rpc GetUserById(GetUserByIdRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
  rpc ChangePassword(ChangePasswordRequest) returns (ChangePasswordResponse);
  rpc VerifyUser(VerifyUserRequest) returns (User);
  rpc UpdateUserStatus(UpdateUserStatusRequest) returns (User);
  rpc HealthCheck(Empty) returns (HealthCheckResponse);
}

message GetUsersRequest {
  int32 page = 1;
  int32 per_page = 2;
  optional UserRole role = 3;
  optional UserStatus status = 4;
}

message GetUsersResponse {
  repeated User users = 1;
  Pagination pagination = 2;
}

message GetUserByIdRequest {
  int32 user_id = 1;
}

message CreateUserRequest {
  string username = 1;
  string email = 2;
  string password = 3;
  optional string first_name = 4;
  optional string last_name = 5;
  optional string phone = 6;
  optional UserRole role = 7;
}

message UpdateUserRequest {
  int32 user_id = 1;
  optional string email = 2;
  optional string first_name = 3;
  optional string last_name = 4;
  optional string phone = 5;
  optional string avatar_url = 6;
}

message DeleteUserRequest {
  int32 user_id = 1;
}

message DeleteUserResponse {
  bool success = 1;
  string message = 2;
}

message ChangePasswordRequest {
  int32 user_id = 1;
  string old_password = 2;
  string new_password = 3;
}

message ChangePasswordResponse {
  bool success = 1;
  string message = 2;
}

message VerifyUserRequest {
  int32 user_id = 1;
}

message UpdateUserStatusRequest {
  int32 user_id = 1;
  UserStatus status = 2;
}
```

---

## 16. DOCKER CONFIGURATION

```dockerfile
# docker/Dockerfile.monolithic

FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Build application
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:22-alpine AS runner

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Environment
ENV NODE_ENV=production
ENV DEPLOYMENT_MODE=monolithic
ENV DEPLOYMENT_LAYER=monolithic

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml (Monolithic)

version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: docker/Dockerfile.monolithic
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://arcana:arcana_pass@db:3306/arcana_cloud
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - DEPLOYMENT_MODE=monolithic
    depends_on:
      - db
      - redis

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root_pass
      - MYSQL_DATABASE=arcana_cloud
      - MYSQL_USER=arcana
      - MYSQL_PASSWORD=arcana_pass
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  mysql_data:
```

```yaml
# docker-compose.layered.yml

version: '3.8'

services:
  controller:
    build:
      context: .
      dockerfile: docker/Dockerfile.controller
    ports:
      - "3000:3000"
    environment:
      - DEPLOYMENT_MODE=layered
      - DEPLOYMENT_LAYER=controller
      - COMMUNICATION_PROTOCOL=http
      - SERVICE_URLS=http://service:3001
    depends_on:
      - service

  service:
    build:
      context: .
      dockerfile: docker/Dockerfile.service
    ports:
      - "3001:3001"
    environment:
      - DEPLOYMENT_MODE=layered
      - DEPLOYMENT_LAYER=service
      - COMMUNICATION_PROTOCOL=http
      - REPOSITORY_URLS=http://repository:3002
      - DATABASE_URL=mysql://arcana:arcana_pass@db:3306/arcana_cloud
    depends_on:
      - repository
      - db

  repository:
    build:
      context: .
      dockerfile: docker/Dockerfile.repository
    ports:
      - "3002:3002"
    environment:
      - DEPLOYMENT_MODE=layered
      - DEPLOYMENT_LAYER=repository
      - DATABASE_URL=mysql://arcana:arcana_pass@db:3306/arcana_cloud
    depends_on:
      - db

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root_pass
      - MYSQL_DATABASE=arcana_cloud
      - MYSQL_USER=arcana
      - MYSQL_PASSWORD=arcana_pass
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

---

## 17. ENVIRONMENT VARIABLES

```bash
# .env.example

# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Database
DATABASE_URL="mysql://arcana:arcana_pass@localhost:3306/arcana_cloud"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-secret-key-min-32-characters-for-development"
JWT_ACCESS_EXPIRES_IN="1h"
JWT_ACCESS_EXPIRES_IN_SECONDS=3600
JWT_REFRESH_EXPIRES_IN="30d"
JWT_REFRESH_EXPIRES_IN_SECONDS=2592000

# Deployment
DEPLOYMENT_MODE=monolithic
DEPLOYMENT_LAYER=monolithic
COMMUNICATION_PROTOCOL=http
SERVICE_URLS=http://localhost:5001
REPOSITORY_URLS=http://localhost:5002

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=info
```

---

## 18. PACKAGE.JSON

```json
{
  "name": "arcana-cloud-nodejs",
  "version": "1.0.0",
  "description": "Enterprise Node.js cloud application with Clean Architecture",
  "main": "src/index.ts",
  "type": "module",
  "scripts": {
    "dev": "node --experimental-transform-types --watch src/index.ts",
    "dev:debug": "node --experimental-transform-types --inspect --watch src/index.ts",
    "start": "node --experimental-transform-types src/index.ts",
    "start:prod": "NODE_ENV=production node --experimental-transform-types src/index.ts",
    "build": "tsc --build",
    "build:check": "tsc --noEmit",
    "test": "node --experimental-transform-types --test tests/**/*.test.ts",
    "test:vitest": "vitest",
    "test:coverage": "vitest --coverage",
    "test:integration": "node --experimental-transform-types --test tests/integration/**/*.test.ts",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:push": "prisma db push",
    "grpc:generate": "grpc_tools_node_protoc --ts_out=./src/grpc/generated --grpc_out=grpc_js:./src/grpc/generated -I ./src/grpc/protos ./src/grpc/protos/*.proto"
  },
  "dependencies": {
    "@grpc/grpc-js": "^1.12.0",
    "@grpc/proto-loader": "^0.7.13",
    "@prisma/client": "^6.0.0",
    "axios": "^1.7.0",
    "bcrypt": "^5.1.1",
    "compression": "^1.7.5",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^5.0.1",
    "express-rate-limit": "^7.4.0",
    "helmet": "^8.0.0",
    "ioredis": "^5.4.0",
    "jsonwebtoken": "^9.0.2",
    "pino": "^9.5.0",
    "uuid": "^11.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/compression": "^1.7.5",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.10.0",
    "@types/uuid": "^10.0.0",
    "@typescript-eslint/eslint-plugin": "^8.17.0",
    "@typescript-eslint/parser": "^8.17.0",
    "eslint": "^9.16.0",
    "pino-pretty": "^13.0.0",
    "prettier": "^3.4.0",
    "prisma": "^6.0.0",
    "supertest": "^7.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  },
  "engines": {
    "node": ">=22.6.0"
  }
}
```

> **Note:** Node.js 22.6.0+ is required for native TypeScript support with `--experimental-transform-types`. See https://nodejs.org/api/typescript.html#full-typescript-support

---

## 19. TSCONFIG.JSON

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## 20. KEY ARCHITECTURAL PRINCIPLES

### 1. Clean Architecture Compliance
- **Separation of Concerns**: Each layer has distinct responsibility
- **Dependency Inversion**: Interfaces define contracts; implementations inject via DI
- **No Circular Dependencies**: Unidirectional flow (Controller → Service → Repository)

### 2. Communication Abstraction
- **Protocol Agnostic**: Same code runs with Direct/HTTP/gRPC
- **Factory Pattern**: Runtime selection based on environment
- **Load Balancing**: Round-robin for multiple service URLs
- **Retry Logic**: Exponential backoff for transient failures

### 3. Type Safety
- **Strict TypeScript**: All parameters and returns typed
- **Zod Validation**: Runtime schema validation
- **Prisma Types**: Database-level type safety

### 4. Error Handling
- **Custom Exception Hierarchy**: Typed exceptions with status codes
- **Global Error Handler**: Consistent error responses
- **Structured Logging**: JSON logs with request context

### 5. Security
- **JWT Authentication**: HS256 with access/refresh tokens
- **Password Hashing**: bcrypt with 12 rounds
- **Rate Limiting**: Per-client request throttling
- **Input Validation**: Schema validation on all inputs
- **CORS Configuration**: Whitelist-based origin control

### 6. Deployment Flexibility
- **Three Modes**: Monolithic, Layered, Microservices
- **Environment-Driven**: No code changes between modes
- **Container-Ready**: Multi-stage Docker builds
- **Kubernetes-Native**: Full K8s manifest support

---

## 21. PERFORMANCE CHARACTERISTICS

| Metric | HTTP | gRPC | Improvement |
|--------|------|------|-------------|
| Average Latency | 15ms | 5.4ms | 2.78x faster |
| Point Queries | 12ms | 1.9ms | 6.30x faster |
| List Operations | 25ms | 8ms | 3.1x faster |
| Throughput | 1000 RPS | 2800 RPS | 2.8x higher |

---

## 22. TESTING STRATEGY

```typescript
// tests/integration/auth.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = createApp();
const request = supertest(app);

describe('Auth API', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Test@1234'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('testuser');
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });

    it('should reject duplicate username', async () => {
      await request
        .post('/api/v1/auth/register')
        .send({
          username: 'duplicate',
          email: 'dup1@example.com',
          password: 'Test@1234'
        });

      const response = await request
        .post('/api/v1/auth/register')
        .send({
          username: 'duplicate',
          email: 'dup2@example.com',
          password: 'Test@1234'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Register first
      await request
        .post('/api/v1/auth/register')
        .send({
          username: 'logintest',
          email: 'login@example.com',
          password: 'Test@1234'
        });

      const response = await request
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: 'logintest',
          password: 'Test@1234'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({
          usernameOrEmail: 'nonexistent',
          password: 'WrongPass@1'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });
});
```

---

## USAGE INSTRUCTIONS

### Prerequisites

- **Node.js 22.6.0+** (required for native TypeScript support)
- MySQL 8.x or PostgreSQL 16.x
- Redis 7.x (optional, for caching)

Verify Node.js version:
```bash
node --version  # Must be v22.6.0 or higher
```

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd arcana-cloud-nodejs

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Setup database (run migrations)
npx prisma migrate dev

# Start development server with native TypeScript (no build step!)
npm run dev
# Or run directly:
node --experimental-transform-types --watch src/index.ts
```

### Running TypeScript Directly (No Transpilation)

Node.js 22+ supports running TypeScript files directly without a build step:

```bash
# Development with watch mode
node --experimental-transform-types --watch src/index.ts

# Production (still uses native TypeScript)
NODE_ENV=production node --experimental-transform-types src/index.ts

# With debugging
node --experimental-transform-types --inspect src/index.ts

# Using environment variable instead of flag
NODE_OPTIONS="--experimental-transform-types" node src/index.ts
```

Reference: https://nodejs.org/api/typescript.html#full-typescript-support

### Running Tests

```bash
# Unit tests (using Node.js native test runner)
npm test

# Using Vitest
npm run test:vitest

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage
```

### Deployment Modes

```bash
# Monolithic (default)
DEPLOYMENT_MODE=monolithic npm start

# Layered (run each in separate terminal)
DEPLOYMENT_LAYER=controller DEPLOYMENT_MODE=layered PORT=3000 npm start
DEPLOYMENT_LAYER=service DEPLOYMENT_MODE=layered PORT=3001 npm start
DEPLOYMENT_LAYER=repository DEPLOYMENT_MODE=layered PORT=3002 npm start

# With gRPC protocol
COMMUNICATION_PROTOCOL=grpc DEPLOYMENT_MODE=layered npm start

# Microservices mode
DEPLOYMENT_MODE=microservices COMMUNICATION_PROTOCOL=grpc npm start
```

### Docker

```bash
# Build and run monolithic
docker-compose up --build

# Build and run layered
docker-compose -f docker-compose.layered.yml up --build

# Build and run microservices with gRPC
docker-compose -f docker-compose.microservices.yml up --build
```

### Docker with Native TypeScript

```dockerfile
# Use Node.js 22+ for native TypeScript support
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Run TypeScript directly - no build step needed!
CMD ["node", "--experimental-transform-types", "src/index.ts"]
```

---

This comprehensive prompt provides all the architectural patterns, code examples, and configuration needed to build a Node.js/TypeScript version of the Arcana Cloud platform with the same enterprise-grade features as the Python implementation.
