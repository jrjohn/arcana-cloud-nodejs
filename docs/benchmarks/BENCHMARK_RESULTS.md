# Benchmark Results

## Test Environment

- **Database**: MySQL 8.0 (Docker)
- **Iterations**: 150 per operation
- **Date**: 2024-12

## Overall Performance

| Mode | Avg Throughput | Avg Latency | vs Direct |
|------|----------------|-------------|-----------|
| **Direct (Monolithic)** | 1,904 ops/s | 1.21ms | baseline |
| **Layered gRPC** | 906 ops/s | 1.66ms | -52.4% |
| **Layered HTTP** | 502 ops/s | 2.27ms | -73.6% |
| **K8s gRPC** | 302 ops/s | 3.42ms | -84.1% |
| **K8s HTTP** | 217 ops/s | 4.75ms | -88.6% |

## gRPC vs HTTP Comparison

| Environment | gRPC Advantage |
|-------------|----------------|
| **Layered** | +80.4% faster |
| **Kubernetes** | +39.2% faster |

## Operation Breakdown

### Create User
| Mode | Throughput | Latency | P95 |
|------|------------|---------|-----|
| Direct | 589 ops/s | 1.70ms | 3.13ms |
| Layered gRPC | 480 ops/s | 2.08ms | 3.46ms |
| Layered HTTP | 366 ops/s | 2.73ms | 4.35ms |

### Get User (Read)
| Mode | Throughput | Latency | P95 |
|------|------------|---------|-----|
| Direct | 4,539 ops/s | 0.22ms | 0.26ms |
| Layered gRPC | 1,808 ops/s | 0.55ms | 0.62ms |
| Layered HTTP | 781 ops/s | 1.28ms | 1.37ms |

### Update User
| Mode | Throughput | Latency | P95 |
|------|------------|---------|-----|
| Direct | 584 ops/s | 1.71ms | 3.07ms |
| Layered gRPC | 429 ops/s | 2.33ms | 3.26ms |
| Layered HTTP | 359 ops/s | 2.78ms | 3.96ms |

## Key Findings

1. **Direct mode is fastest** - No serialization or network overhead
2. **gRPC outperforms HTTP by 80%** in layered deployments
3. **Read operations show largest gap** - Minimal DB overhead amplifies protocol differences
4. **K8s adds overhead** - Service mesh, DNS, overlay network

## Recommendations

| Scenario | Recommended Mode |
|----------|------------------|
| Development | Direct (Monolithic) |
| Small Production | Direct (Monolithic) |
| Medium Scale | Layered + gRPC |
| Enterprise/HA | Kubernetes + gRPC |

## Running Benchmarks

```bash
# Start test database
npm run db:test:up

# Run MySQL benchmark
DATABASE_URL="mysql://arcana_test:arcana_test_pass@localhost:3307/arcana_test" \
  node --experimental-transform-types tests/benchmark/mysql-all-modes.benchmark.ts
```
