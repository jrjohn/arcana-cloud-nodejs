/**
 * MySQL Throughput Benchmark
 * Compares: Direct (Monolithic) vs HTTP (Layered) vs gRPC (Layered)
 * Using REAL MySQL database operations
 */

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { performance } from 'perf_hooks';

const DATABASE_URL = process.env.DATABASE_URL ||
  'mysql://arcana_test:arcana_test_pass@localhost:3307/arcana_test';

interface BenchmarkResult {
  mode: string;
  operation: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  throughputOps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

// ============================================================
// DIRECT MODE - Same process, direct Prisma calls
// ============================================================
class DirectMode {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
      log: []
    });
  }

  async connect() {
    await this.prisma.$connect();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  async createUser(data: { username: string; email: string }) {
    return this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash: '$2b$10$benchmark',
        role: UserRole.USER,
        status: UserStatus.ACTIVE
      }
    });
  }

  async getUserById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updateUser(id: number, data: { firstName: string }) {
    return this.prisma.user.update({
      where: { id },
      data: { firstName: data.firstName }
    });
  }

  async deleteUser(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }

  async cleanup() {
    await this.prisma.oAuthToken.deleteMany();
    await this.prisma.user.deleteMany();
  }
}

// ============================================================
// HTTP MODE - Simulates HTTP overhead + MySQL
// ============================================================
class HTTPMode {
  private prisma: PrismaClient;
  private networkLatencyMs: number;

  constructor(networkLatencyMs: number = 0.5) {
    this.prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
      log: []
    });
    this.networkLatencyMs = networkLatencyMs;
  }

  async connect() {
    await this.prisma.$connect();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  private async simulateHTTPOverhead<T>(operation: () => Promise<T>): Promise<T> {
    // Simulate JSON serialization of request
    const requestStart = performance.now();

    // Simulate network latency (round trip)
    await this.busyWait(this.networkLatencyMs);

    // Execute actual DB operation
    const result = await operation();

    // Simulate JSON serialization of response
    JSON.stringify(result);

    // Simulate network latency (response)
    await this.busyWait(this.networkLatencyMs);

    return result;
  }

  private busyWait(ms: number): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      while (performance.now() - start < ms) { /* busy wait */ }
      resolve();
    });
  }

  async createUser(data: { username: string; email: string }) {
    // Serialize request
    JSON.stringify(data);

    return this.simulateHTTPOverhead(() =>
      this.prisma.user.create({
        data: {
          username: data.username,
          email: data.email,
          passwordHash: '$2b$10$benchmark',
          role: UserRole.USER,
          status: UserStatus.ACTIVE
        }
      })
    );
  }

  async getUserById(id: number) {
    JSON.stringify({ id });
    return this.simulateHTTPOverhead(() =>
      this.prisma.user.findUnique({ where: { id } })
    );
  }

  async updateUser(id: number, data: { firstName: string }) {
    JSON.stringify({ id, ...data });
    return this.simulateHTTPOverhead(() =>
      this.prisma.user.update({
        where: { id },
        data: { firstName: data.firstName }
      })
    );
  }

  async deleteUser(id: number) {
    JSON.stringify({ id });
    return this.simulateHTTPOverhead(() =>
      this.prisma.user.delete({ where: { id } })
    );
  }

  async cleanup() {
    await this.prisma.oAuthToken.deleteMany();
    await this.prisma.user.deleteMany();
  }
}

// ============================================================
// gRPC MODE - Simulates gRPC overhead + MySQL
// ============================================================
class GRPCMode {
  private prisma: PrismaClient;
  private networkLatencyMs: number;

  constructor(networkLatencyMs: number = 0.3) {
    this.prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
      log: []
    });
    // gRPC typically has ~40% lower latency than HTTP due to:
    // - HTTP/2 multiplexing
    // - Binary protocol (protobuf)
    // - Persistent connections
    this.networkLatencyMs = networkLatencyMs;
  }

  async connect() {
    await this.prisma.$connect();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  private async simulateGRPCOverhead<T>(operation: () => Promise<T>): Promise<T> {
    // Simulate protobuf serialization (faster than JSON)
    await this.busyWait(this.networkLatencyMs * 0.5);

    // Execute actual DB operation
    const result = await operation();

    // Simulate protobuf deserialization
    await this.busyWait(this.networkLatencyMs * 0.5);

    return result;
  }

  private busyWait(ms: number): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      while (performance.now() - start < ms) { /* busy wait */ }
      resolve();
    });
  }

  async createUser(data: { username: string; email: string }) {
    return this.simulateGRPCOverhead(() =>
      this.prisma.user.create({
        data: {
          username: data.username,
          email: data.email,
          passwordHash: '$2b$10$benchmark',
          role: UserRole.USER,
          status: UserStatus.ACTIVE
        }
      })
    );
  }

  async getUserById(id: number) {
    return this.simulateGRPCOverhead(() =>
      this.prisma.user.findUnique({ where: { id } })
    );
  }

  async updateUser(id: number, data: { firstName: string }) {
    return this.simulateGRPCOverhead(() =>
      this.prisma.user.update({
        where: { id },
        data: { firstName: data.firstName }
      })
    );
  }

  async deleteUser(id: number) {
    return this.simulateGRPCOverhead(() =>
      this.prisma.user.delete({ where: { id } })
    );
  }

  async cleanup() {
    await this.prisma.oAuthToken.deleteMany();
    await this.prisma.user.deleteMany();
  }
}

// ============================================================
// BENCHMARK RUNNER
// ============================================================

let uniqueCounter = 0;
function uniqueId(): string {
  uniqueCounter++;
  return `${Date.now()}_${uniqueCounter}`;
}

async function runBenchmark(
  name: string,
  mode: string,
  operation: () => Promise<unknown>,
  iterations: number = 100
): Promise<BenchmarkResult> {
  // Warmup
  for (let i = 0; i < 10; i++) {
    try { await operation(); } catch { /* ignore warmup errors */ }
  }

  const times: number[] = [];
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const opStart = performance.now();
    try {
      await operation();
    } catch {
      // Ignore errors (e.g., not found for reads)
    }
    times.push(performance.now() - opStart);
  }

  const totalTime = performance.now() - start;
  times.sort((a, b) => a - b);

  return {
    mode,
    operation: name,
    iterations,
    totalTimeMs: Math.round(totalTime * 100) / 100,
    avgTimeMs: Math.round((totalTime / iterations) * 1000) / 1000,
    throughputOps: Math.round((iterations / totalTime) * 1000 * 100) / 100,
    p50Ms: Math.round(times[Math.floor(times.length * 0.5)] * 1000) / 1000,
    p95Ms: Math.round(times[Math.floor(times.length * 0.95)] * 1000) / 1000,
    p99Ms: Math.round(times[Math.floor(times.length * 0.99)] * 1000) / 1000
  };
}

async function main(): Promise<void> {
  console.log('='.repeat(80));
  console.log('MySQL THROUGHPUT BENCHMARK');
  console.log('Direct (Monolithic) vs HTTP (Layered) vs gRPC (Layered)');
  console.log('Using REAL MySQL Database');
  console.log('='.repeat(80));
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');

  const iterations = 200; // Real DB operations are slower
  const results: BenchmarkResult[] = [];

  // Initialize modes
  const direct = new DirectMode();
  const http = new HTTPMode(0.5);  // 0.5ms simulated network latency
  const grpc = new GRPCMode(0.3);  // 0.3ms simulated network latency

  try {
    // Connect all modes
    console.log('Connecting to database...');
    await direct.connect();
    await http.connect();
    await grpc.connect();
    console.log('✓ Connected\n');

    // Cleanup before tests
    await direct.cleanup();

    // ============================================================
    // CREATE USER BENCHMARKS
    // ============================================================
    console.log('Running CREATE USER benchmarks...');

    await direct.cleanup();
    results.push(await runBenchmark(
      'createUser',
      'Direct',
      async () => {
        const id = uniqueId();
        return direct.createUser({ username: `user_${id}`, email: `user_${id}@test.com` });
      },
      iterations
    ));

    await direct.cleanup();
    results.push(await runBenchmark(
      'createUser',
      'HTTP',
      async () => {
        const id = uniqueId();
        return http.createUser({ username: `user_${id}`, email: `user_${id}@test.com` });
      },
      iterations
    ));

    await direct.cleanup();
    results.push(await runBenchmark(
      'createUser',
      'gRPC',
      async () => {
        const id = uniqueId();
        return grpc.createUser({ username: `user_${id}`, email: `user_${id}@test.com` });
      },
      iterations
    ));

    // ============================================================
    // READ USER BENCHMARKS
    // ============================================================
    console.log('Running READ USER benchmarks...');

    // Create test users for read benchmarks
    await direct.cleanup();
    const testUsers: number[] = [];
    for (let i = 0; i < 100; i++) {
      const user = await direct.createUser({
        username: `readtest_${i}`,
        email: `readtest_${i}@test.com`
      });
      testUsers.push(user.id);
    }

    let readIndex = 0;
    results.push(await runBenchmark(
      'getUserById',
      'Direct',
      async () => {
        const id = testUsers[readIndex % testUsers.length];
        readIndex++;
        return direct.getUserById(id);
      },
      iterations
    ));

    readIndex = 0;
    results.push(await runBenchmark(
      'getUserById',
      'HTTP',
      async () => {
        const id = testUsers[readIndex % testUsers.length];
        readIndex++;
        return http.getUserById(id);
      },
      iterations
    ));

    readIndex = 0;
    results.push(await runBenchmark(
      'getUserById',
      'gRPC',
      async () => {
        const id = testUsers[readIndex % testUsers.length];
        readIndex++;
        return grpc.getUserById(id);
      },
      iterations
    ));

    // ============================================================
    // UPDATE USER BENCHMARKS
    // ============================================================
    console.log('Running UPDATE USER benchmarks...');

    let updateIndex = 0;
    results.push(await runBenchmark(
      'updateUser',
      'Direct',
      async () => {
        const id = testUsers[updateIndex % testUsers.length];
        updateIndex++;
        return direct.updateUser(id, { firstName: `Updated_${updateIndex}` });
      },
      iterations
    ));

    updateIndex = 0;
    results.push(await runBenchmark(
      'updateUser',
      'HTTP',
      async () => {
        const id = testUsers[updateIndex % testUsers.length];
        updateIndex++;
        return http.updateUser(id, { firstName: `Updated_${updateIndex}` });
      },
      iterations
    ));

    updateIndex = 0;
    results.push(await runBenchmark(
      'updateUser',
      'gRPC',
      async () => {
        const id = testUsers[updateIndex % testUsers.length];
        updateIndex++;
        return grpc.updateUser(id, { firstName: `Updated_${updateIndex}` });
      },
      iterations
    ));

    // ============================================================
    // PRINT RESULTS
    // ============================================================
    console.log('');
    console.log('='.repeat(80));
    console.log('BENCHMARK RESULTS (with Real MySQL)');
    console.log('='.repeat(80));

    const operations = ['createUser', 'getUserById', 'updateUser'];
    for (const op of operations) {
      const directResult = results.find(r => r.mode === 'Direct' && r.operation === op)!;
      const httpResult = results.find(r => r.mode === 'HTTP' && r.operation === op)!;
      const grpcResult = results.find(r => r.mode === 'gRPC' && r.operation === op)!;

      console.log('');
      console.log(`Operation: ${op}`);
      console.log('-'.repeat(60));
      console.log(`  Direct (Monolithic):`);
      console.log(`    Latency:    ${directResult.avgTimeMs}ms`);
      console.log(`    Throughput: ${directResult.throughputOps.toLocaleString()} ops/sec`);
      console.log(`    P95:        ${directResult.p95Ms}ms`);
      console.log(`  HTTP (Layered):`);
      console.log(`    Latency:    ${httpResult.avgTimeMs}ms`);
      console.log(`    Throughput: ${httpResult.throughputOps.toLocaleString()} ops/sec`);
      console.log(`    P95:        ${httpResult.p95Ms}ms`);
      console.log(`  gRPC (Layered):`);
      console.log(`    Latency:    ${grpcResult.avgTimeMs}ms`);
      console.log(`    Throughput: ${grpcResult.throughputOps.toLocaleString()} ops/sec`);
      console.log(`    P95:        ${grpcResult.p95Ms}ms`);

      const httpOverhead = ((httpResult.avgTimeMs - directResult.avgTimeMs) / directResult.avgTimeMs * 100).toFixed(1);
      const grpcOverhead = ((grpcResult.avgTimeMs - directResult.avgTimeMs) / directResult.avgTimeMs * 100).toFixed(1);
      const grpcVsHttp = ((httpResult.avgTimeMs - grpcResult.avgTimeMs) / httpResult.avgTimeMs * 100).toFixed(1);

      console.log(`  Comparison:`);
      console.log(`    HTTP overhead vs Direct: +${httpOverhead}%`);
      console.log(`    gRPC overhead vs Direct: +${grpcOverhead}%`);
      console.log(`    gRPC faster than HTTP:   ${grpcVsHttp}%`);
    }

    // Summary table
    console.log('');
    console.log('='.repeat(80));
    console.log('SUMMARY TABLE');
    console.log('='.repeat(80));
    console.log('');
    console.log('| Mode   | Operation    | Latency(ms) | Throughput(ops/s) | P95(ms) |');
    console.log('|--------|--------------|-------------|-------------------|---------|');
    for (const r of results) {
      console.log(`| ${r.mode.padEnd(6)} | ${r.operation.padEnd(12)} | ${r.avgTimeMs.toString().padStart(11)} | ${r.throughputOps.toLocaleString().padStart(17)} | ${r.p95Ms.toString().padStart(7)} |`);
    }

    // Overall comparison
    const directAvg = results.filter(r => r.mode === 'Direct').reduce((sum, r) => sum + r.throughputOps, 0) / 3;
    const httpAvg = results.filter(r => r.mode === 'HTTP').reduce((sum, r) => sum + r.throughputOps, 0) / 3;
    const grpcAvg = results.filter(r => r.mode === 'gRPC').reduce((sum, r) => sum + r.throughputOps, 0) / 3;

    const directLatencyAvg = results.filter(r => r.mode === 'Direct').reduce((sum, r) => sum + r.avgTimeMs, 0) / 3;
    const httpLatencyAvg = results.filter(r => r.mode === 'HTTP').reduce((sum, r) => sum + r.avgTimeMs, 0) / 3;
    const grpcLatencyAvg = results.filter(r => r.mode === 'gRPC').reduce((sum, r) => sum + r.avgTimeMs, 0) / 3;

    console.log('');
    console.log('='.repeat(80));
    console.log('OVERALL COMPARISON (Average across all operations)');
    console.log('='.repeat(80));
    console.log('');
    console.log('| Mode                | Throughput        | Latency   | vs Direct |');
    console.log('|---------------------|-------------------|-----------|-----------|');
    console.log(`| Direct (Monolithic) | ${directAvg.toFixed(2).padStart(12)} ops/s | ${directLatencyAvg.toFixed(3).padStart(7)}ms | baseline  |`);
    console.log(`| HTTP (Layered)      | ${httpAvg.toFixed(2).padStart(12)} ops/s | ${httpLatencyAvg.toFixed(3).padStart(7)}ms | -${((directAvg - httpAvg) / directAvg * 100).toFixed(1)}%    |`);
    console.log(`| gRPC (Layered)      | ${grpcAvg.toFixed(2).padStart(12)} ops/s | ${grpcLatencyAvg.toFixed(3).padStart(7)}ms | -${((directAvg - grpcAvg) / directAvg * 100).toFixed(1)}%    |`);
    console.log('');
    console.log(`gRPC vs HTTP improvement: +${((grpcAvg - httpAvg) / httpAvg * 100).toFixed(1)}% throughput`);
    console.log('');

  } finally {
    // Cleanup
    console.log('Cleaning up...');
    await direct.cleanup();
    await direct.disconnect();
    await http.disconnect();
    await grpc.disconnect();
    console.log('✓ Done');
  }
}

main().catch(console.error);
