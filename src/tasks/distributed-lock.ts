import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

let redis: Redis | undefined;

function getRedis(): Redis {
  if (!redis && config.redisUrl) {
    redis = new Redis(config.redisUrl);
  }
  if (!redis) {
    throw new Error('Redis required for distributed locking');
  }
  return redis;
}

/**
 * Distributed Lock using Redis
 * Implements Redlock-like single instance algorithm
 */
export class DistributedLock {
  private lockKey: string;
  private lockValue: string;
  private ttlMs: number;
  private renewInterval?: NodeJS.Timeout;

  constructor(
    private name: string,
    options?: { ttlMs?: number }
  ) {
    this.lockKey = `lock:${name}`;
    this.lockValue = `${process.pid}-${Date.now()}-${Math.random()}`;
    this.ttlMs = options?.ttlMs || 30000; // 30 seconds default
  }

  /**
   * Acquire lock with automatic renewal
   */
  async acquire(): Promise<boolean> {
    const client = getRedis();

    // SET NX with expiry - atomic operation
    const result = await client.set(
      this.lockKey,
      this.lockValue,
      'PX',
      this.ttlMs,
      'NX'
    );

    if (result === 'OK') {
      // Start auto-renewal at half TTL
      this.startRenewal();
      logger.info(`Lock acquired: ${this.name}`);
      return true;
    }

    return false;
  }

  /**
   * Release lock - only if we own it
   */
  async release(): Promise<boolean> {
    this.stopRenewal();

    const client = getRedis();

    // Lua script ensures atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await client.eval(script, 1, this.lockKey, this.lockValue);

    if (result === 1) {
      logger.info(`Lock released: ${this.name}`);
      return true;
    }

    logger.warn(`Lock not released (not owner): ${this.name}`);
    return false;
  }

  /**
   * Extend lock TTL
   */
  async extend(ttlMs?: number): Promise<boolean> {
    const client = getRedis();
    const newTtl = ttlMs || this.ttlMs;

    // Only extend if we own the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await client.eval(script, 1, this.lockKey, this.lockValue, newTtl);
    return result === 1;
  }

  private startRenewal(): void {
    // Renew at half TTL interval
    const renewalInterval = this.ttlMs / 2;

    this.renewInterval = setInterval(async () => {
      const extended = await this.extend();
      if (!extended) {
        logger.warn(`Failed to extend lock: ${this.name}`);
        this.stopRenewal();
      }
    }, renewalInterval);
  }

  private stopRenewal(): void {
    if (this.renewInterval) {
      clearInterval(this.renewInterval);
      this.renewInterval = undefined;
    }
  }
}

/**
 * Execute function with distributed lock
 * Ensures only one instance executes at a time
 */
export async function withLock<T>(
  lockName: string,
  fn: () => Promise<T>,
  options?: { ttlMs?: number; waitMs?: number; retries?: number }
): Promise<T | null> {
  const lock = new DistributedLock(lockName, { ttlMs: options?.ttlMs });
  const maxRetries = options?.retries || 0;
  const waitMs = options?.waitMs || 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const acquired = await lock.acquire();

    if (acquired) {
      try {
        return await fn();
      } finally {
        await lock.release();
      }
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  logger.warn(`Could not acquire lock: ${lockName}`);
  return null;
}

/**
 * Leader Election for scheduled tasks
 * Only one instance becomes leader and runs scheduled jobs
 */
export class LeaderElection {
  private lock: DistributedLock;
  private isLeader = false;
  private electionInterval?: NodeJS.Timeout;
  private onBecomeLeader?: () => void;
  private onLoseLeadership?: () => void;

  constructor(
    private name: string,
    options?: {
      ttlMs?: number;
      electionIntervalMs?: number;
      onBecomeLeader?: () => void;
      onLoseLeadership?: () => void;
    }
  ) {
    this.lock = new DistributedLock(`leader:${name}`, { ttlMs: options?.ttlMs || 30000 });
    this.onBecomeLeader = options?.onBecomeLeader;
    this.onLoseLeadership = options?.onLoseLeadership;
  }

  /**
   * Start participating in leader election
   */
  async start(electionIntervalMs = 10000): Promise<void> {
    // Try to become leader immediately
    await this.tryBecomeLeader();

    // Keep trying periodically
    this.electionInterval = setInterval(async () => {
      await this.tryBecomeLeader();
    }, electionIntervalMs);

    logger.info(`Started leader election: ${this.name}`);
  }

  /**
   * Stop participating in election
   */
  async stop(): Promise<void> {
    if (this.electionInterval) {
      clearInterval(this.electionInterval);
      this.electionInterval = undefined;
    }

    if (this.isLeader) {
      await this.lock.release();
      this.isLeader = false;
      this.onLoseLeadership?.();
    }

    logger.info(`Stopped leader election: ${this.name}`);
  }

  /**
   * Check if this instance is the leader
   */
  getIsLeader(): boolean {
    return this.isLeader;
  }

  private async tryBecomeLeader(): Promise<void> {
    const wasLeader = this.isLeader;

    if (this.isLeader) {
      // Try to extend leadership
      const extended = await this.lock.extend();
      if (!extended) {
        this.isLeader = false;
        logger.warn(`Lost leadership: ${this.name}`);
        this.onLoseLeadership?.();
      }
    } else {
      // Try to acquire leadership
      const acquired = await this.lock.acquire();
      if (acquired) {
        this.isLeader = true;
        logger.info(`Became leader: ${this.name}`);
        this.onBecomeLeader?.();
      }
    }
  }
}

export async function closeDistributedLock(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = undefined;
  }
}
