import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Exclude database tests - they need to run sequentially with their own config
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/database/**'
    ],
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './docs/test-reports/test-results.json'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './docs/test-reports/coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'src/grpc/generated/'
      ]
    }
  }
});
