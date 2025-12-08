# Architecture Documentation

## Overview

Arcana Cloud Node.js implements a **Clean Architecture** with 3 distinct layers that can be deployed together (monolithic) or separately (layered/microservices).

## Layer Architecture

```
┌─────────────────────────────────────────────────┐
│                 Controller Layer                │
│  - HTTP REST API (Express.js)                   │
│  - Request validation (Zod)                     │
│  - Authentication (JWT)                         │
│  - Rate limiting                                │
└─────────────────────┬───────────────────────────┘
                      │ gRPC / HTTP / Direct
┌─────────────────────▼───────────────────────────┐
│                  Service Layer                  │
│  - Business logic                               │
│  - Use case orchestration                       │
│  - Transaction management                       │
└─────────────────────┬───────────────────────────┘
                      │ gRPC / HTTP / Direct
┌─────────────────────▼───────────────────────────┐
│                Repository Layer                 │
│  - Data access (Prisma ORM)                     │
│  - Query abstraction                            │
│  - Cache coordination                           │
└─────────────────────┬───────────────────────────┘
                      │
              ┌───────┴───────┐
              │               │
         ┌────▼────┐    ┌─────▼─────┐
         │ MySQL   │    │   Redis   │
         └─────────┘    └───────────┘
```

## Deployment Modes

### 1. Monolithic
- Single process
- Direct function calls
- Best for: Development, small deployments

### 2. Layered
- 3 separate containers
- gRPC communication (default)
- Best for: Production, independent scaling

### 3. Kubernetes
- Pod-based scaling
- Service mesh support
- Best for: Enterprise, high availability

## Communication Protocols

| Protocol | Overhead | Use Case |
|----------|----------|----------|
| Direct | 0ms | Monolithic deployment |
| gRPC | ~0.3ms | Layered/K8s (recommended) |
| HTTP | ~1ms | External APIs, legacy systems |

## Key Design Patterns

1. **Factory Pattern** - `CommunicationFactory` for protocol selection
2. **Repository Pattern** - Data access abstraction
3. **Dependency Injection** - Manual DI container
4. **Strategy Pattern** - Swappable communication implementations

## Security Layers

1. **Authentication** - JWT with access/refresh tokens
2. **Authorization** - Role-based access control (RBAC)
3. **Validation** - Zod schema validation
4. **Rate Limiting** - Per-endpoint limits
5. **Security Headers** - Helmet.js

## Data Flow

```
Request → Controller → Middleware → Service → Repository → Database
                ↓                       ↓           ↓
           Validation              Business      Prisma ORM
           Auth Check              Logic
```

## Error Handling

- Custom exception classes with HTTP status codes
- Request ID correlation across logs
- Structured error responses
- Development vs production error details
