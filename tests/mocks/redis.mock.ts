import { vi } from 'vitest';

export const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  eval: vi.fn(),
  quit: vi.fn(),
  pexpire: vi.fn()
};

export function resetRedisMocks(): void {
  Object.values(mockRedis).forEach(mock => mock.mockReset());
}
