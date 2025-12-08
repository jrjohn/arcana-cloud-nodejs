import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run database tests sequentially to avoid conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    // Only include database tests
    include: ['tests/database/**/*.test.ts'],
    // Longer timeout for database operations
    testTimeout: 30000,
    // Run tests in sequence within each file
    sequence: {
      concurrent: false
    }
  }
});
