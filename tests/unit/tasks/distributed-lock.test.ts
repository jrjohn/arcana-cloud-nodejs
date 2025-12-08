import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DistributedLock, withLock, LeaderElection, closeDistributedLock } from '../../../src/tasks/distributed-lock.js';

// Mock Redis
const mockRedis = {
  set: vi.fn(),
  eval: vi.fn(),
  quit: vi.fn()
};

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => mockRedis)
}));

vi.mock('../../../src/config.js', () => ({
  config: {
    redisUrl: 'redis://localhost:6379'
  }
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('DistributedLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await closeDistributedLock();
  });

  describe('constructor', () => {
    it('should create lock with default TTL', () => {
      const lock = new DistributedLock('test-lock');
      expect(lock).toBeDefined();
    });

    it('should create lock with custom TTL', () => {
      const lock = new DistributedLock('test-lock', { ttlMs: 60000 });
      expect(lock).toBeDefined();
    });
  });

  describe('acquire', () => {
    it('should acquire lock successfully', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const lock = new DistributedLock('test-lock');
      const result = await lock.acquire();

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:test-lock',
        expect.any(String),
        'PX',
        30000,
        'NX'
      );
    });

    it('should fail to acquire lock if already held', async () => {
      mockRedis.set.mockResolvedValue(null);

      const lock = new DistributedLock('test-lock');
      const result = await lock.acquire();

      expect(result).toBe(false);
    });

    it('should start renewal after acquiring lock', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = new DistributedLock('test-lock', { ttlMs: 10000 });
      await lock.acquire();

      // Fast forward half TTL to trigger renewal
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockRedis.eval).toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('should release lock if owner', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = new DistributedLock('test-lock');
      await lock.acquire();
      const result = await lock.release();

      expect(result).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('if redis.call("get"'),
        1,
        'lock:test-lock',
        expect.any(String)
      );
    });

    it('should fail to release lock if not owner', async () => {
      mockRedis.eval.mockResolvedValue(0);

      const lock = new DistributedLock('test-lock');
      const result = await lock.release();

      expect(result).toBe(false);
    });

    it('should stop renewal on release', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = new DistributedLock('test-lock', { ttlMs: 10000 });
      await lock.acquire();
      await lock.release();

      // Fast forward - renewal should not trigger
      await vi.advanceTimersByTimeAsync(10000);

      // Only one eval call from release, none from renewal
      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    });
  });

  describe('extend', () => {
    it('should extend lock TTL if owner', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = new DistributedLock('test-lock');
      await lock.acquire();
      const result = await lock.extend();

      expect(result).toBe(true);
    });

    it('should extend lock with custom TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const lock = new DistributedLock('test-lock');
      await lock.acquire();
      await lock.extend(60000);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'lock:test-lock',
        expect.any(String),
        60000
      );
    });

    it('should fail to extend if not owner', async () => {
      mockRedis.eval.mockResolvedValue(0);

      const lock = new DistributedLock('test-lock');
      const result = await lock.extend();

      expect(result).toBe(false);
    });
  });
});

describe('withLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await closeDistributedLock();
  });

  it('should execute function when lock acquired', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.eval.mockResolvedValue(1);

    const fn = vi.fn().mockResolvedValue('result');
    const result = await withLock('test-lock', fn);

    expect(fn).toHaveBeenCalled();
    expect(result).toBe('result');
  });

  it('should release lock after execution', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.eval.mockResolvedValue(1);

    const fn = vi.fn().mockResolvedValue('result');
    await withLock('test-lock', fn);

    expect(mockRedis.eval).toHaveBeenCalled();
  });

  it('should return null when lock not acquired', async () => {
    mockRedis.set.mockResolvedValue(null);

    const fn = vi.fn().mockResolvedValue('result');
    const result = await withLock('test-lock', fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should retry with wait when specified', async () => {
    mockRedis.set
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('OK');
    mockRedis.eval.mockResolvedValue(1);

    const fn = vi.fn().mockResolvedValue('result');
    const promise = withLock('test-lock', fn, { retries: 1, waitMs: 1000 });

    // Advance timer to trigger retry
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;

    expect(mockRedis.set).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalled();
    expect(result).toBe('result');
  });

  it('should release lock even if function throws', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.eval.mockResolvedValue(1);

    const fn = vi.fn().mockRejectedValue(new Error('Function error'));

    await expect(withLock('test-lock', fn)).rejects.toThrow('Function error');
    expect(mockRedis.eval).toHaveBeenCalled();
  });
});

describe('LeaderElection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await closeDistributedLock();
  });

  describe('start', () => {
    it('should try to become leader immediately', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const onBecomeLeader = vi.fn();
      const election = new LeaderElection('test-election', { onBecomeLeader });

      await election.start();

      expect(mockRedis.set).toHaveBeenCalled();
      expect(onBecomeLeader).toHaveBeenCalled();
      expect(election.getIsLeader()).toBe(true);

      await election.stop();
    });

    it('should keep trying to become leader periodically', async () => {
      mockRedis.set
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('OK');

      const onBecomeLeader = vi.fn();
      const election = new LeaderElection('test-election', { onBecomeLeader });

      await election.start(1000);

      expect(election.getIsLeader()).toBe(false);

      // Advance timer to trigger retry
      await vi.advanceTimersByTimeAsync(1000);

      expect(election.getIsLeader()).toBe(true);
      expect(onBecomeLeader).toHaveBeenCalled();

      await election.stop();
    });

    it('should extend lock when already leader', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const election = new LeaderElection('test-election');
      await election.start(1000);

      expect(election.getIsLeader()).toBe(true);

      // Advance timer to trigger extend
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockRedis.eval).toHaveBeenCalled();

      await election.stop();
    });
  });

  describe('stop', () => {
    it('should release lock and stop election', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const onLoseLeadership = vi.fn();
      const election = new LeaderElection('test-election', { onLoseLeadership });

      await election.start();
      expect(election.getIsLeader()).toBe(true);

      await election.stop();

      expect(election.getIsLeader()).toBe(false);
      expect(onLoseLeadership).toHaveBeenCalled();
    });

    it('should stop even if not leader', async () => {
      mockRedis.set.mockResolvedValue(null);

      const election = new LeaderElection('test-election');
      await election.start();
      await election.stop();

      expect(election.getIsLeader()).toBe(false);
    });
  });

  describe('leadership callbacks', () => {
    it('should call onBecomeLeader when becoming leader', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const onBecomeLeader = vi.fn();
      const election = new LeaderElection('test-election', { onBecomeLeader });

      await election.start();

      expect(onBecomeLeader).toHaveBeenCalled();

      await election.stop();
    });

    it('should call onLoseLeadership when losing leadership', async () => {
      mockRedis.set.mockResolvedValue('OK');
      // First acquire succeeds, then extend fails
      mockRedis.eval.mockResolvedValueOnce(1); // First extend for renewal

      const onLoseLeadership = vi.fn();
      const election = new LeaderElection('test-election', {
        ttlMs: 2000,
        onLoseLeadership
      });

      await election.start(1000);
      expect(election.getIsLeader()).toBe(true);

      // Now make extend fail
      mockRedis.eval.mockResolvedValue(0);

      // Advance timer to trigger extend attempt
      await vi.advanceTimersByTimeAsync(1000);

      expect(onLoseLeadership).toHaveBeenCalled();
      expect(election.getIsLeader()).toBe(false);

      await election.stop();
    });
  });
});
