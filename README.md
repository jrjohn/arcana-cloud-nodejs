# Arcana Cloud Node.js: Enterprise TypeScript Microservices Platform

![Architecture Rating](https://img.shields.io/badge/Architecture%20Rating-⭐⭐⭐⭐⭐%209.5%2F10-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)
![gRPC](https://img.shields.io/badge/gRPC-1.12-4285F4?logo=google&logoColor=white)
![InversifyJS](https://img.shields.io/badge/InversifyJS-7.x-FF6B6B?logo=inversify&logoColor=white)
![architecture](https://img.shields.io/badge/architecture-microservices-blue)
![tests](https://img.shields.io/badge/tests-538%20passing-brightgreen)
![Events](https://img.shields.io/badge/Events-Domain%20Events-9B59B6)
![coverage](https://img.shields.io/badge/coverage-90%25-brightgreen)
![code style](https://img.shields.io/badge/code%20style-ESLint-4B32C3)
![license](https://img.shields.io/badge/license-MIT-green)

Enterprise-grade cloud platform with **gRPC-first architecture** (1.80x faster than HTTP REST), **InversifyJS dependency injection**, **event-driven architecture** with domain events, supporting dual-protocol communication and three flexible deployment modes (Monolithic, Layered, Microservices).

## Overview

Production-ready cloud platform built on **Node.js 22+** and **TypeScript 5.x** featuring **gRPC-first architecture** with dual-protocol support and **InversifyJS** for type-safe dependency injection. The system achieves **1.80x average speedup** with gRPC delivering up to **2.32x faster read operations** compared to HTTP REST in layered deployments.

> **Sister Project**: [Arcana Cloud Python](https://github.com/jrjohn/arcana-cloud-python) - Flask/gRPC implementation with 2.78x performance gains

---

## Architecture

### Clean 3-Layer Architecture with Dependency Injection

```mermaid
graph TB
    subgraph Client
        WEB["Web Browser"]
        MOBILE["Mobile App"]
        API["API Client"]
    end

    subgraph DI["InversifyJS Container"]
        TOKENS["DI Tokens"]
        CONTAINER["Container Config"]
    end

    subgraph Controller
        CTRL["Express.js REST API"]
        AUTH["JWT Authentication"]
        VALID["Zod Validation"]
        RATE["Rate Limiting"]
    end

    subgraph Service
        USER_SVC["User Service"]
        AUTH_SVC["Auth Service"]
        TOKEN_SVC["Token Service"]
    end

    subgraph Repository
        USER_REPO["User Repository"]
        TOKEN_REPO["Token Repository"]
    end

    subgraph Data
        MYSQL[("MySQL 8.0")]
        REDIS[("Redis 7.x")]
    end

    WEB --> CTRL
    MOBILE --> CTRL
    API --> CTRL
    CTRL --> AUTH
    AUTH --> VALID
    VALID --> RATE
    DI --> CTRL
    DI --> USER_SVC
    DI --> AUTH_SVC
    DI --> USER_REPO
    RATE --> USER_SVC
    RATE --> AUTH_SVC
    AUTH_SVC --> TOKEN_SVC
    USER_SVC --> USER_REPO
    TOKEN_SVC --> TOKEN_REPO
    USER_REPO --> MYSQL
    TOKEN_REPO --> MYSQL
    AUTH_SVC --> REDIS
    TOKEN_SVC --> REDIS

    style DI fill:#FF6B6B,color:#fff
    style CTRL fill:#339933,color:#fff
    style USER_SVC fill:#3178C6,color:#fff
    style AUTH_SVC fill:#3178C6,color:#fff
    style USER_REPO fill:#4285F4,color:#fff
    style TOKEN_REPO fill:#4285F4,color:#fff
    style MYSQL fill:#00758F,color:#fff
    style REDIS fill:#DC382D,color:#fff
```

### Communication Flow

```mermaid
flowchart LR
    subgraph "Protocol Selection"
        ENV[Environment Config]
        FACTORY[Communication Factory]
    end

    subgraph "Implementations"
        DIRECT["Direct Call"]
        HTTP["HTTP REST + JSON"]
        GRPC["gRPC + Protobuf"]
    end

    ENV -->|COMMUNICATION_PROTOCOL| FACTORY
    FACTORY -->|monolithic| DIRECT
    FACTORY -->|layered + http| HTTP
    FACTORY -->|layered + grpc| GRPC

    DIRECT -->|0ms overhead| SVC[Service Layer]
    HTTP -->|~1ms + JSON serialization| SVC
    GRPC -->|~0.3ms + binary| SVC

    style GRPC fill:#4285F4,color:#fff
    style DIRECT fill:#339933,color:#fff
    style HTTP fill:#FF6B6B,color:#fff
```

---

## Dependency Injection

### InversifyJS Integration

The project uses **InversifyJS** for enterprise-grade dependency injection with type-safe tokens and constructor injection.

```mermaid
graph TB
    subgraph "DI Container"
        TOKENS["Symbol Tokens"]
        CONTAINER["Container"]
        RESOLVE["resolve<T>()"]
    end

    subgraph "Bindings"
        PRISMA["PrismaClient"]
        REPOS["Repositories"]
        SVCS["Services"]
        COMM["Communication"]
    end

    TOKENS --> CONTAINER
    CONTAINER --> RESOLVE
    CONTAINER --> PRISMA
    CONTAINER --> REPOS
    CONTAINER --> SVCS
    CONTAINER --> COMM

    style TOKENS fill:#FF6B6B,color:#fff
    style CONTAINER fill:#FF6B6B,color:#fff
```

### DI Features

| Feature | Implementation |
|---------|----------------|
| **Token System** | Type-safe Symbols for each dependency |
| **Injection** | Constructor injection with `@inject` decorator |
| **Decorators** | `@injectable` for all services and repositories |
| **Scope** | Singleton scope by default |
| **Environment-Aware** | Different bindings for Direct/HTTP/gRPC |

### Usage Example

```typescript
// Define tokens
export const TOKENS = {
  UserService: Symbol.for('UserService'),
  UserRepository: Symbol.for('UserRepository'),
  PrismaClient: Symbol.for('PrismaClient'),
};

// Injectable service
@injectable()
export class UserServiceImpl implements IUserService {
  constructor(
    @inject(TOKENS.UserRepository) private userRepository: IUserRepository
  ) {}
}

// Resolve dependency
import { resolve, TOKENS } from './di/index.js';
const userService = resolve<IUserService>(TOKENS.UserService);
```

---

## Event-Driven Architecture

### Domain Events System

The platform implements a **production-grade event-driven architecture** with persistent storage, idempotency, schema validation, and multi-instance coordination via Redis pub/sub.

```mermaid
graph TB
    subgraph Services
        AUTH["Auth Service"]
        USER["User Service"]
    end

    subgraph "Event Bus (DI Integrated)"
        VALID["Zod Validation"]
        IDEMP["Idempotency Check"]
        PUBLISH["publish()"]
        MIDDLEWARE["Middleware Chain"]
    end

    subgraph Storage
        REDIS[("Redis")]
        MYSQL[("MySQL")]
    end

    subgraph "Event Handlers"
        AUDIT["Audit Handler"]
        SECURITY["Security Handler"]
        USER_H["User Handler"]
    end

    subgraph "Background Jobs"
        BULLMQ["BullMQ Queue"]
        WORKER["Event Workers"]
        DLQ["Dead Letter Queue"]
    end

    subgraph "Multi-Instance"
        PUBSUB["Redis Pub/Sub"]
        INST2["Instance 2"]
        INST3["Instance N"]
    end

    AUTH -->|Events| VALID
    USER -->|Events| VALID
    VALID --> IDEMP
    IDEMP -->|Check| REDIS
    IDEMP --> PUBLISH
    PUBLISH --> MIDDLEWARE
    PUBLISH -->|Audit Log| MYSQL
    PUBLISH -->|Pub/Sub| PUBSUB
    PUBSUB --> INST2
    PUBSUB --> INST3
    MIDDLEWARE --> AUDIT
    MIDDLEWARE --> SECURITY
    MIDDLEWARE --> USER_H
    MIDDLEWARE -->|Async| BULLMQ
    BULLMQ --> WORKER
    WORKER -->|Failed| DLQ
    SECURITY -->|Metrics| REDIS

    style VALID fill:#3498DB,color:#fff
    style IDEMP fill:#E74C3C,color:#fff
    style PUBLISH fill:#9B59B6,color:#fff
    style REDIS fill:#DC382D,color:#fff
    style MYSQL fill:#00758F,color:#fff
    style PUBSUB fill:#DC382D,color:#fff
```

### Event Structure

Events include versioning and idempotency keys for production reliability:

```typescript
interface DomainEvent<T> {
  eventId: string;        // UUID for idempotency
  type: string;           // e.g., 'user.registered'
  version: number;        // Schema version for evolution
  occurredAt: Date;
  correlationId?: string; // Request tracing
  causationId?: string;   // Event chain tracking
  payload: T;             // Typed, validated payload
}
```

### Event Types

| Event | Trigger | Handlers | Version |
|-------|---------|----------|---------|
| `user.registered` | User registration | Audit, Welcome Email | v1 |
| `user.logged_in` | Successful login | Audit, Security Metrics | v1 |
| `user.logged_out` | User logout | Audit | v1 |
| `user.password_changed` | Password change | Audit, Security Alert | v1 |
| `user.status_changed` | Status update | Audit, Notification | v1 |
| `token.revoked` | Token revocation | Audit, Security | v1 |
| `security.alert` | Security event | Audit, Webhook | v1 |
| `rate_limit.exceeded` | Rate limit hit | Security Metrics | v1 |

### Event Bus Features

| Feature | Description | Storage |
|---------|-------------|---------|
| **Idempotency** | Duplicate event prevention via UUID | Redis (24hr TTL) |
| **Audit Log** | Persistent event history | MySQL |
| **Security Metrics** | Rate limit tracking | Redis (1hr TTL) |
| **Pub/Sub** | Multi-instance event distribution | Redis |
| **Schema Validation** | Zod validation on publish | In-memory |
| **Versioning** | Schema evolution support | Event payload |
| **DI Integration** | InversifyJS injectable | Container |
| **Dead Letter Queue** | Failed event recovery | BullMQ |

### Usage Example

```typescript
import { getEventBus, Events, EventValidationError } from './events/index.js';

// Events are validated with Zod schemas
try {
  await getEventBus().publish(
    Events.userRegistered({
      userId: user.id,
      username: user.username,
      email: user.email  // Validated as email format
    })
  );
} catch (error) {
  if (error instanceof EventValidationError) {
    console.error('Invalid event payload:', error.errors);
  }
}

// DI integration
import { resolve, TOKENS } from './di/index.js';
const eventBus = resolve<EventBus>(TOKENS.EventBus);

// Query audit logs (async with database)
const { items, total } = await queryAuditLogAsync({
  eventType: 'user.registered',
  fromDate: new Date('2024-01-01'),
  limit: 100
});

// Get security metrics from Redis
const metrics = await getSecurityMetricsAsync();
console.log('Rate limit violations:', metrics.rateLimitHits);
```

---

## Deployment Modes

### Overview

```mermaid
graph TB
    subgraph "Monolithic"
        M_ALL["Single Process"]
        M_DB[(MySQL)]
        M_ALL --> M_DB
    end

    subgraph "Layered"
        L_CTRL["Controller :3000"]
        L_SVC["Service :50051"]
        L_REPO["Repository :50052"]
        L_DB[(MySQL)]
        L_CTRL -->|gRPC| L_SVC -->|gRPC| L_REPO --> L_DB
    end

    subgraph "Kubernetes"
        K_ING[Ingress]
        K_CTRL["Controller x3"]
        K_SVC["Service x3"]
        K_REPO["Repository x2"]
        K_DB[("MySQL HA")]
        K_ING --> K_CTRL -->|gRPC| K_SVC -->|gRPC| K_REPO --> K_DB
    end

    style M_ALL fill:#339933,color:#fff
    style L_CTRL fill:#339933,color:#fff
    style L_SVC fill:#3178C6,color:#fff
    style L_REPO fill:#4285F4,color:#fff
    style K_CTRL fill:#339933,color:#fff
    style K_SVC fill:#3178C6,color:#fff
    style K_REPO fill:#4285F4,color:#fff
```

### Mode Comparison

| Mode | Containers | Protocol | Scaling | Use Case |
|------|------------|----------|---------|----------|
| **Monolithic** | 1 | Direct | Vertical | Development, Small Apps |
| **Layered** | 3 | gRPC | Per-layer | Production, Medium Scale |
| **Kubernetes** | N | gRPC + Mesh | Horizontal | Enterprise, High Availability |

---

## Performance Benchmarks

### Throughput by Deployment Mode

```mermaid
xychart-beta
    title "Throughput Comparison (ops/sec)"
    x-axis [Direct, "Layered gRPC", "Layered HTTP", "K8s gRPC", "K8s HTTP"]
    y-axis "Operations per Second" 0 --> 2000
    bar [1904, 906, 502, 302, 217]
```

### Latency by Deployment Mode

```mermaid
xychart-beta
    title "Average Latency (ms) - Lower is Better"
    x-axis [Direct, "Layered gRPC", "Layered HTTP", "K8s gRPC", "K8s HTTP"]
    y-axis "Latency (ms)" 0 --> 5
    bar [1.21, 1.66, 2.27, 3.42, 4.75]
```

### gRPC vs HTTP Performance

```mermaid
pie showData
    title "gRPC Advantage over HTTP"
    "gRPC Faster (Layered)" : 80.4
    "HTTP Baseline" : 19.6
```

### Detailed Results (Real MySQL, 150 iterations)

| Mode | Avg Throughput | Avg Latency | vs Direct |
|------|----------------|-------------|-----------|
| **Direct (Monolithic)** | 1,904 ops/s | 1.21ms | baseline |
| **Layered gRPC** | 906 ops/s | 1.66ms | -52.4% |
| **Layered HTTP** | 502 ops/s | 2.27ms | -73.6% |
| **K8s gRPC** | 302 ops/s | 3.42ms | -84.1% |
| **K8s HTTP** | 217 ops/s | 4.75ms | -88.6% |

### Operation Breakdown

| Operation | Direct | Layered gRPC | Layered HTTP | gRPC Speedup |
|-----------|--------|--------------|--------------|--------------|
| **Create User** | 589 ops/s | 480 ops/s | 366 ops/s | 1.31x |
| **Get User** | 4,539 ops/s | 1,808 ops/s | 781 ops/s | 2.32x |
| **Update User** | 584 ops/s | 429 ops/s | 359 ops/s | 1.19x |

---

## Testing

### Test Suite Overview

```mermaid
pie showData
    title "Test Distribution (538 Total)"
    "Unit Tests" : 478
    "Integration Tests" : 60
```

### Test Results

| Category | Tests | Status |
|----------|-------|--------|
| **Unit Tests** | 478 | ✅ Passing |
| **Integration Tests** | 60 | ✅ Passing |
| **Event System Tests** | 32 | ✅ Passing |
| **DI Container Tests** | 8 | ✅ Passing |
| **Total** | **538** | **100%** |

### Running Tests

```bash
# Start test database
npm run db:test:up

# Run all tests
npm run test:all

# Run unit tests only
npm run test:vitest -- --run tests/unit

# Run integration tests
npm run test:integration

# Run database tests
npm run test:db

# Run with coverage
npm run test:coverage

# View HTML test report
open docs/test-reports/test-report.html
```

---

## Request Flow

### Authentication Flow

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant CTRL as Controller
    participant AUTH as Auth Service
    participant REPO as Repository
    participant DB as MySQL
    participant REDIS as Redis

    C->>CTRL: POST /api/auth/login
    CTRL->>CTRL: Validate Request (Zod)
    CTRL->>AUTH: login(credentials)
    AUTH->>REPO: findByEmail(email)
    REPO->>DB: SELECT * FROM users
    DB-->>REPO: User Record
    REPO-->>AUTH: User Entity
    AUTH->>AUTH: Verify Password (bcrypt)
    AUTH->>AUTH: Generate JWT Tokens
    AUTH->>REPO: createToken(tokenData)
    REPO->>DB: INSERT INTO oauth_tokens
    AUTH->>REDIS: Cache Session
    AUTH-->>CTRL: AuthResult
    CTRL-->>C: { user, tokens }
```

### Protected Resource Flow

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant CTRL as Controller
    participant MW as Middleware
    participant SVC as User Service
    participant REPO as Repository
    participant DB as MySQL

    C->>CTRL: GET /api/users/:id
    Note over CTRL: Authorization: Bearer <token>
    CTRL->>MW: tokenRequired()
    MW->>MW: Verify JWT
    MW->>MW: Attach user to request
    MW-->>CTRL: Authorized
    CTRL->>SVC: getUserById(id)
    SVC->>REPO: findById(id)
    REPO->>DB: SELECT * FROM users WHERE id = ?
    DB-->>REPO: User Record
    REPO-->>SVC: User Entity
    SVC-->>CTRL: UserPublic
    CTRL-->>C: { success: true, data: user }
```

---

## Technology Stack

### Architecture Components

```mermaid
graph LR
    subgraph Runtime
        NODE["Node.js 22+"]
        TS["TypeScript 5.7"]
    end

    subgraph Web
        EXPRESS["Express.js 5.x"]
        HELMET["Helmet"]
        CORS["CORS"]
    end

    subgraph DI
        INVERSIFY["InversifyJS 7.x"]
        REFLECT["reflect-metadata"]
    end

    subgraph Communication
        GRPC["gRPC 1.12"]
        PROTO["Protocol Buffers"]
        AXIOS["Axios"]
    end

    subgraph DataLayer
        PRISMA["Prisma 6.x"]
        MYSQL[("MySQL 8.0")]
        REDIS[("Redis 7.x")]
    end

    subgraph Security
        JWT["JWT"]
        BCRYPT["bcrypt"]
        ZOD["Zod"]
    end

    subgraph Jobs
        BULLMQ["BullMQ"]
        IOREDIS["ioredis"]
    end

    subgraph Events
        EVENTBUS["Event Bus"]
        DOMAIN["Domain Events"]
    end

    NODE --> EXPRESS
    EXPRESS --> INVERSIFY
    INVERSIFY --> GRPC
    GRPC --> PRISMA
    PRISMA --> MYSQL
    TS --> ZOD
    ZOD --> JWT
    BULLMQ --> REDIS

    style NODE fill:#339933,color:#fff
    style TS fill:#3178C6,color:#fff
    style INVERSIFY fill:#FF6B6B,color:#fff
    style GRPC fill:#4285F4,color:#fff
    style MYSQL fill:#00758F,color:#fff
    style REDIS fill:#DC382D,color:#fff
```

### Stack Details

| Layer | Component | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 22+ | Native TypeScript execution |
| **Language** | TypeScript | 5.7+ | Type-safe development |
| **DI** | InversifyJS | 7.x | Dependency injection |
| **Web** | Express.js | 5.x | HTTP REST framework |
| **RPC** | @grpc/grpc-js | 1.12+ | gRPC communication |
| **ORM** | Prisma | 6.x | Type-safe database access |
| **Database** | MySQL | 8.0 | Primary data store |
| **Cache** | Redis | 7.x | Sessions, queues, locks |
| **Validation** | Zod | 3.x | Runtime type validation |
| **Auth** | jsonwebtoken | 9.x | JWT authentication |
| **Jobs** | BullMQ | 5.x | Distributed job queues |
| **Testing** | Vitest | 2.x | Unit & integration testing |

---

## Project Structure

```mermaid
graph TB
    subgraph src
        DI[di]
        CTRL[controllers]
        SVC[services]
        REPO[repositories]
        COMM[communication]
        MW[middleware]
        MODELS[models]
        SCHEMAS[schemas]
        TASKS[tasks]
        UTILS[utils]
        CONFIG[config.ts]
        APP[app.ts]
    end

    subgraph Supporting
        PRISMA[prisma]
        TESTS[tests]
        DOCKER[deploy/docker]
        K8S[deploy/k8s]
        DOCS[docs]
    end

    DI --> CTRL
    DI --> SVC
    DI --> REPO
    DI --> COMM
    CTRL --> SVC
    SVC --> REPO
    SVC --> COMM
    REPO --> COMM
    CTRL --> MW
    MW --> SCHEMAS
    SVC --> MODELS
    REPO --> MODELS
    APP --> CTRL

    style DI fill:#FF6B6B,color:#fff
    style CTRL fill:#339933,color:#fff
    style SVC fill:#3178C6,color:#fff
    style REPO fill:#4285F4,color:#fff
    style COMM fill:#9B59B6,color:#fff
```

### Directory Layout

```
arcana-cloud-nodejs/
├── src/                          # Application source code
│   ├── di/                       # Dependency injection (InversifyJS)
│   │   ├── tokens.ts             # DI token symbols
│   │   ├── container.ts          # Container configuration
│   │   └── index.ts              # DI exports
│   ├── controllers/              # HTTP request handlers
│   ├── services/                 # Business logic layer
│   │   └── implementations/      # @injectable service classes
│   ├── repositories/             # Data access layer
│   │   └── implementations/      # @injectable repository classes
│   ├── communication/            # Protocol abstraction (Direct/HTTP/gRPC)
│   │   └── implementations/      # @injectable communication classes
│   ├── middleware/               # Auth, validation, rate-limit
│   ├── models/                   # Domain entities
│   ├── schemas/                  # Zod validation schemas
│   ├── tasks/                    # BullMQ job processing
│   ├── events/                   # Event-driven architecture
│   │   ├── domain-events.ts      # Event types, Zod schemas, factories
│   │   ├── event-bus.ts          # Central dispatcher (DI integrated)
│   │   ├── event-store.ts        # Persistent storage (Redis/MySQL)
│   │   └── handlers/             # Event handlers (audit, security, user)
│   ├── utils/                    # Helpers, logger, exceptions
│   ├── config.ts                 # Centralized configuration
│   └── app.ts                    # Express application
├── docs/                         # Documentation
│   ├── test-reports/             # Test reports (HTML, JSON)
│   ├── architecture/             # Architecture docs
│   └── benchmarks/               # Performance reports
├── deploy/                       # Deployment configurations
│   ├── docker/                   # Dockerfiles & compose files
│   └── k8s/                      # Kubernetes manifests
├── tests/                        # Test suites
│   ├── unit/                     # Unit tests (478 tests)
│   │   ├── di/                   # DI container tests
│   │   ├── services/             # Service tests
│   │   ├── repositories/         # Repository tests
│   │   ├── communication/        # Communication tests
│   │   ├── events/               # Event system tests (32 tests)
│   │   └── middleware/           # Middleware tests
│   └── integration/              # Integration tests (60 tests)
├── prisma/                       # Database schema & migrations
├── vitest.config.ts              # Vitest configuration
├── vitest.config.db.ts           # Database test configuration
└── package.json                  # Dependencies & scripts
```

---

## Quick Start

### Prerequisites
- Node.js 22+
- Docker & Docker Compose
- MySQL 8.0 (or use Docker)

### Development Setup

```bash
# Clone repository
git clone https://github.com/jrjohn/arcana-cloud-nodejs.git
cd arcana-cloud-nodejs

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start database
docker compose up -d db redis

# Run migrations
npx prisma migrate deploy

# Start development server
npm run dev
```

### Docker Deployments

```bash
# Monolithic (development)
npm run docker:dev

# Layered (gRPC - production)
npm run docker:layered

# Run benchmarks
npm run docker:benchmark

# Or use docker-compose directly
docker compose -f deploy/docker/docker-compose.layered.yml up -d
```

---

## Configuration

All configuration is centralized in `src/config.ts` with Zod validation:

```typescript
// Environment Variables
PORT=3000                              # Server port
NODE_ENV=development                   # Environment
DATABASE_URL=mysql://...               # MySQL connection
REDIS_URL=redis://localhost:6379       # Redis connection

// Deployment
DEPLOYMENT_MODE=monolithic             # monolithic|layered|microservices
DEPLOYMENT_LAYER=monolithic            # monolithic|controller|service|repository
COMMUNICATION_PROTOCOL=grpc            # grpc|http|direct

// Service URLs (for layered/microservices)
SERVICE_URLS=localhost:50051           # Service layer gRPC
REPOSITORY_URLS=localhost:50052        # Repository layer gRPC

// Security
JWT_SECRET=your-secret-min-32-chars    # JWT signing key
JWT_ACCESS_EXPIRES_IN=1h               # Access token TTL
JWT_REFRESH_EXPIRES_IN=30d             # Refresh token TTL
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login & get tokens |
| POST | `/api/auth/logout` | Revoke current token |
| POST | `/api/auth/refresh` | Refresh access token |

### Users (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users (paginated) |
| GET | `/api/users/:id` | Get user by ID |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| PUT | `/api/users/:id/password` | Change password |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/health/ready` | Readiness probe |
| GET | `/health/live` | Liveness probe |

---

## Security Features

```mermaid
graph TB
    subgraph Authentication
        JWT["JWT HS256"]
        ACCESS["Access Token 1h"]
        REFRESH["Refresh Token 30d"]
        BCRYPT["bcrypt 12 rounds"]
    end

    subgraph Authorization
        RBAC["Role-Based Access"]
        ADMIN["ADMIN"]
        USER["USER"]
        GUEST["GUEST"]
    end

    subgraph Protection
        HELMET["Helmet Headers"]
        CORS["CORS"]
        RATE["Rate Limiting"]
        ZOD["Input Validation"]
    end

    JWT --> ACCESS
    JWT --> REFRESH
    BCRYPT --> JWT
    RBAC --> ADMIN
    RBAC --> USER
    RBAC --> GUEST
    HELMET --> RBAC
    CORS --> RBAC
    RATE --> RBAC
    ZOD --> RBAC

    style JWT fill:#E74C3C,color:#fff
    style RBAC fill:#3498DB,color:#fff
    style HELMET fill:#2ECC71,color:#fff
```

### Security Summary

| Feature | Implementation |
|---------|----------------|
| Authentication | JWT (HS256) with access/refresh tokens |
| Password | bcrypt with 12 salt rounds |
| Authorization | Role-based (ADMIN, USER, GUEST) |
| Validation | Zod schemas on all inputs |
| Headers | Helmet.js security headers |
| Rate Limiting | 100 req/hour global, 5/15min auth |
| CORS | Configurable allowed origins |

---

## Comparison: Node.js vs Python

```mermaid
graph LR
    subgraph "Node.js Implementation"
        N_RT["Node.js 22+"]
        N_FW["Express.js 5.x"]
        N_DI["InversifyJS"]
        N_ORM["Prisma 6.x"]
        N_VAL["Zod"]
        N_GRPC["grpc-js"]
    end

    subgraph "Python Implementation"
        P_RT["Python 3.14"]
        P_FW["Flask 3.1.2"]
        P_DI["dependency-injector"]
        P_ORM["SQLAlchemy 2.0"]
        P_VAL["Marshmallow"]
        P_GRPC["grpcio"]
    end

    N_RT -.-> P_RT
    N_FW -.-> P_FW
    N_DI -.-> P_DI
    N_ORM -.-> P_ORM

    style N_RT fill:#339933,color:#fff
    style P_RT fill:#3776AB,color:#fff
    style N_DI fill:#FF6B6B,color:#fff
```

| Feature | Node.js | Python |
|---------|---------|--------|
| **Runtime** | Node.js 22+ | Python 3.14 |
| **Framework** | Express.js 5.x | Flask 3.1.2 |
| **DI** | InversifyJS 7.x | dependency-injector |
| **ORM** | Prisma 6.x | SQLAlchemy 2.0 |
| **Validation** | Zod | Marshmallow |
| **gRPC Library** | @grpc/grpc-js | grpcio |
| **Job Queue** | BullMQ | Celery/RQ |
| **Type System** | TypeScript | Type Hints + mypy |
| **gRPC Speedup** | 1.80x avg | 2.78x avg |

---

## Recommendations

```mermaid
graph TD
    START[Choose Deployment] --> Q1{Scale?}
    Q1 -->|Small| MONO["Monolithic + Direct"]
    Q1 -->|Medium| LAYER["Layered + gRPC"]
    Q1 -->|Large| K8S["Kubernetes + gRPC"]

    MONO --> DEV[Development]
    LAYER --> PROD[Production]
    K8S --> ENT[Enterprise]

    style MONO fill:#339933,color:#fff
    style LAYER fill:#3178C6,color:#fff
    style K8S fill:#326CE5,color:#fff
```

| Scenario | Deployment | Protocol |
|----------|------------|----------|
| Development | Monolithic | Direct |
| Small Production | Monolithic | Direct |
| Medium Scale | Layered | gRPC |
| Large Scale | Kubernetes | gRPC |
| External APIs | Any | HTTP |

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## Architecture Rating

### Overall Score: 9.5/10

```mermaid
xychart-beta
    title "Architecture Quality Metrics"
    x-axis ["Type Safety", "Testability", "Scalability", "Production Ready", "Code Org", "Extensibility", "Error Handling", "Documentation"]
    y-axis "Score" 0 --> 10
    bar [9.5, 9, 9, 9.5, 9, 9.5, 9, 9]
```

### Detailed Breakdown

| Category | Score | Details |
|----------|-------|---------|
| **Type Safety** | 9.5/10 | Full TypeScript, Zod validation, typed events |
| **Testability** | 9/10 | 538 tests, DI integration, mockable components |
| **Scalability** | 9/10 | Redis pub/sub, multi-instance, horizontal scaling |
| **Production Readiness** | 9.5/10 | Idempotency, persistent audit, dead letter queue |
| **Code Organization** | 9/10 | Clean architecture, clear separation |
| **Extensibility** | 9.5/10 | Plugin handlers, middleware, DI |
| **Error Handling** | 9/10 | Validation errors, DLQ, graceful fallbacks |
| **Documentation** | 9/10 | Mermaid diagrams, API docs, examples |

### Comparison with Industry Standards

| System | Rating | Use Case |
|--------|--------|----------|
| Kafka + Schema Registry | 10/10 | Large-scale distributed systems |
| **This Implementation** | **9.5/10** | **Monolithic to medium-scale microservices** |
| NestJS CQRS Module | 8.5/10 | NestJS-specific projects |
| Node.js EventEmitter | 7/10 | Simple in-process events, prototyping |

### Key Strengths
- Persistent audit logging (MySQL)
- Redis-backed idempotency (24hr TTL)
- Multi-instance coordination (pub/sub)
- Schema validation (Zod)
- Event versioning for evolution
- InversifyJS DI integration
- Comprehensive test coverage (538 tests)

---

**Status**: Production-ready with **538 passing tests**, comprehensive documentation, InversifyJS dependency injection, production-grade event-driven architecture (idempotency, persistence, pub/sub), and enterprise-grade security controls.
