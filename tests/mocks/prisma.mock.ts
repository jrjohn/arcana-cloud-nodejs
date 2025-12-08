import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

export const mockPrismaUser = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn()
};

export const mockPrismaOAuthToken = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn()
};

export const mockPrisma = {
  user: mockPrismaUser,
  oAuthToken: mockPrismaOAuthToken,
  $connect: vi.fn(),
  $disconnect: vi.fn()
} as unknown as PrismaClient;

export function resetPrismaMocks(): void {
  Object.values(mockPrismaUser).forEach(mock => mock.mockReset());
  Object.values(mockPrismaOAuthToken).forEach(mock => mock.mockReset());
}
