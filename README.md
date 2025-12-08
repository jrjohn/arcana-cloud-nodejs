# Arcana Cloud Node.js: Enterprise TypeScript Microservices Platform

![Architecture Rating](https://img.shields.io/badge/Architecture%20Rating-⭐⭐⭐⭐⭐%209.0%2F10-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)
![gRPC](https://img.shields.io/badge/gRPC-1.12-4285F4?logo=google&logoColor=white)
![architecture](https://img.shields.io/badge/architecture-microservices-blue)
![tests](https://img.shields.io/badge/tests-passing-brightgreen)
![coverage](https://img.shields.io/badge/coverage-90%25-brightgreen)
![code style](https://img.shields.io/badge/code%20style-ESLint-4B32C3)
![license](https://img.shields.io/badge/license-MIT-green)

Enterprise-grade cloud platform with **gRPC-first architecture** (1.80x faster than HTTP REST), supporting dual-protocol communication and three flexible deployment modes (Monolithic, Layered, Microservices).

## Overview

Production-ready cloud platform built on **Node.js 22+** and **TypeScript 5.x** featuring **gRPC-first architecture** with dual-protocol support. The system achieves **1.80x average speedup** with gRPC delivering up to **2.32x faster read operations** compared to HTTP REST in layered deployments.

> **Sister Project**: [Arcana Cloud Python](https://github.com/jrjohn/arcana-cloud-python) - Flask/gRPC implementation with 2.78x performance gains

## Architecture Highlights

### Clean 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTROLLER LAYER                         │
│              Express.js REST API Gateway                    │
│         JWT Auth · Validation · Rate Limiting               │
└────────────────────────┬────────────────────────────────────┘
                         │ gRPC (default) / HTTP
┌────────────────────────▼────────────────────────────────────┐
│                     SERVICE LAYER                           │
│                   Business Logic                            │
│        User Management · Auth · Token Lifecycle             │
└────────────────────────┬────────────────────────────────────┘
                         │ gRPC (default) / HTTP
┌────────────────────────▼────────────────────────────────────┐
│                   REPOSITORY LAYER                          │
│              Prisma ORM · MySQL · Redis                     │
│           Data Access · Caching · Transactions              │
└─────────────────────────────────────────────────────────────┘
```

### Communication Protocols

| Protocol | Use Case | Performance |
|----------|----------|-------------|
| **gRPC** (Default) | Inter-service communication | 1.80x faster than HTTP |
| **HTTP REST** | External APIs, browser clients | Full compatibility |
| **Direct** | Monolithic deployment | Zero network overhead |

## Performance Benchmarks

### Real MySQL Database Benchmarks (150 iterations)

| Mode | Avg Throughput | Avg Latency | vs Direct |
|------|----------------|-------------|-----------|
| **Direct (Monolithic)** | 1,904 ops/s | 1.21ms | baseline |
| **Layered gRPC** | 906 ops/s | 1.66ms | -52.4% |
| **Layered HTTP** | 502 ops/s | 2.27ms | -73.6% |
| **K8s gRPC** | 302 ops/s | 3.42ms | -84.1% |
| **K8s HTTP** | 217 ops/s | 4.75ms | -88.6% |

### gRPC vs HTTP Comparison

| Environment | gRPC Advantage |
|-------------|----------------|
| **Layered** | +80.4% faster |
| **Kubernetes** | +39.2% faster |

### Operation Breakdown

| Operation | Direct | Layered gRPC | Layered HTTP | gRPC Speedup |
|-----------|--------|--------------|--------------|--------------|
| **Create User** | 589 ops/s | 480 ops/s | 366 ops/s | 1.31x |
| **Get User** | 4,539 ops/s | 1,808 ops/s | 781 ops/s | 2.32x |
| **Update User** | 584 ops/s | 429 ops/s | 359 ops/s | 1.19x |

## Deployment Modes

### 1. Monolithic (Development)
Single process with direct in-memory calls. Zero network overhead.

```bash
# Start monolithic stack
docker compose up -d
```

### 2. Layered (Production Recommended)
Three separate containers with gRPC communication. Independent scaling per layer.

```bash
# Start layered stack with gRPC (default)
docker compose -f docker-compose.layered.yml up -d
```

### 3. Kubernetes (Enterprise Scale)
Full orchestration with service mesh, auto-scaling, and high availability.

```bash
# Apply K8s manifests
kubectl apply -k k8s/overlays/production
```

## Technology Stack

### Core Runtime
| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 22+ | Native TypeScript execution |
| TypeScript | 5.7+ | Type-safe development |
| Express.js | 5.x | HTTP REST framework |

### Communication
| Component | Version | Purpose |
|-----------|---------|---------|
| @grpc/grpc-js | 1.12+ | gRPC framework |
| Protocol Buffers | 3.x | Binary serialization |
| Axios | 1.7+ | HTTP client with retry |

### Data Layer
| Component | Version | Purpose |
|-----------|---------|---------|
| Prisma | 6.x | Type-safe ORM |
| MySQL | 8.0 | Primary database |
| Redis | 7.x | Cache & job queues |

### Security
| Component | Purpose |
|-----------|---------|
| jsonwebtoken | JWT authentication |
| bcrypt | Password hashing (12 rounds) |
| helmet | Security headers |
| Zod | Runtime validation |

### Background Processing
| Component | Purpose |
|-----------|---------|
| BullMQ | Distributed job queues |
| ioredis | Redis client |

## Project Structure

```
arcana-cloud-nodejs/
├── src/
│   ├── controllers/          # HTTP request handlers
│   ├── services/             # Business logic layer
│   │   ├── interfaces/       # Service contracts
│   │   └── implementations/  # Service implementations
│   ├── repositories/         # Data access layer
│   │   ├── interfaces/       # Repository contracts
│   │   └── implementations/  # Prisma implementations
│   ├── communication/        # Protocol abstraction
│   │   ├── interfaces.ts     # Communication contracts
│   │   ├── factory.ts        # Protocol factory
│   │   └── implementations/  # Direct/HTTP/gRPC
│   ├── middleware/           # Express middleware
│   ├── models/               # Domain models
│   ├── schemas/              # Zod validation schemas
│   ├── tasks/                # Background job processing
│   ├── utils/                # Shared utilities
│   ├── config.ts             # Centralized configuration
│   ├── container.ts          # Dependency injection
│   └── app.ts                # Express application
├── prisma/
│   └── schema.prisma         # Database schema
├── tests/
│   ├── unit/                 # Unit tests
│   ├── database/             # Integration tests
│   └── benchmark/            # Performance tests
├── docker/                   # Dockerfiles per layer
├── k8s/                      # Kubernetes manifests
└── docker-compose*.yml       # Compose configurations
```

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

### Running Tests

```bash
# Unit tests
npm run test:vitest

# Database integration tests
npm run db:test:up
npm run test:db

# Run benchmarks
DATABASE_URL="mysql://..." node --experimental-transform-types \
  tests/benchmark/mysql-all-modes.benchmark.ts
```

## Configuration

All configuration is centralized in `src/config.ts` with Zod validation:

```typescript
// Environment Variables
PORT=3000                              # Server port
NODE_ENV=development                   # Environment
DATABASE_URL=mysql://...               # MySQL connection
REDIS_URL=redis://localhost:6379       # Redis connection

# Deployment
DEPLOYMENT_MODE=monolithic             # monolithic|layered|microservices
DEPLOYMENT_LAYER=monolithic            # monolithic|controller|service|repository
COMMUNICATION_PROTOCOL=grpc            # grpc|http|direct

# Service URLs (for layered/microservices)
SERVICE_URLS=localhost:50051           # Service layer gRPC
REPOSITORY_URLS=localhost:50052        # Repository layer gRPC

# Security
JWT_SECRET=your-secret-min-32-chars    # JWT signing key
JWT_ACCESS_EXPIRES_IN=1h               # Access token TTL
JWT_REFRESH_EXPIRES_IN=30d             # Refresh token TTL
```

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

## Security Features

### Authentication & Authorization
- JWT-based authentication (HS256)
- Access + Refresh token pairs
- Role-based access control (ADMIN, USER, GUEST)
- Token revocation & lifecycle management
- Session tracking (IP, User-Agent)

### Input Validation
- Zod schema validation on all inputs
- Password strength requirements:
  - Minimum 8 characters
  - Uppercase, lowercase, number, special char

### HTTP Security
- Helmet.js security headers
- CORS with configurable origins
- Rate limiting (100 req/hour global, 5 req/15min auth)
- Request ID tracking for audit trails

## Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Monolithic deployment |
| `docker-compose.layered.yml` | 3-layer gRPC deployment |
| `docker-compose.test.yml` | Test environment |
| `docker-compose.db-test.yml` | Database testing |
| `docker-compose.benchmark.yml` | Performance testing |

## Comparison: Node.js vs Python Implementation

| Feature | Node.js | Python |
|---------|---------|--------|
| **Runtime** | Node.js 22+ | Python 3.14 |
| **Framework** | Express.js 5.x | Flask 3.1.2 |
| **ORM** | Prisma 6.x | SQLAlchemy 2.0 |
| **Validation** | Zod | Marshmallow |
| **gRPC Library** | @grpc/grpc-js | grpcio |
| **Job Queue** | BullMQ | Celery/RQ |
| **Type System** | TypeScript | Type Hints + mypy |
| **gRPC Speedup** | 1.80x avg | 2.78x avg |

## Unique Features

### 1. Native TypeScript Execution
No build step required. Node.js 22+ executes TypeScript directly via `--experimental-transform-types`.

### 2. Communication Abstraction Layer
Swap between Direct/HTTP/gRPC without code changes. Environment-driven protocol selection.

### 3. Multi-Deployment Architecture
Single codebase supports monolithic → layered → microservices progression.

### 4. Protocol Buffer Contracts
Strongly-typed service definitions with auto-generated TypeScript.

### 5. Distributed Job Processing
BullMQ with priority queues, retry logic, and distributed locks.

## Recommendations

| Scenario | Deployment | Protocol |
|----------|------------|----------|
| Development | Monolithic | Direct |
| Small Production | Monolithic | Direct |
| Medium Scale | Layered | gRPC |
| Large Scale | Kubernetes | gRPC |
| External APIs | Any | HTTP |

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing`)
5. Open Pull Request

---

**Status**: Production-ready with comprehensive test coverage, documented APIs, and enterprise-grade security controls.
