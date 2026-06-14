import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Exclude database tests - they need to run sequentially with their own config
    exclude: [
        // vitest v4: coverage-v8 tries to parse .proto/generated → PARSE_ERROR, pollutes %
        'src/grpc/protos/**',
        '**/*.proto',
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
      reporter: ['text', 'json', 'html', 'lcov', 'cobertura'],
      reportsDirectory: './docs/test-reports/coverage',
      include: ['src/**'],
      exclude: [
        'src/**/*.d.ts',
        'src/grpc/generated/**',
        // Interface-only files (no runtime code)
        'src/repository/base.repository.ts',
        'src/repository/user.repository.ts',
        'src/repository/oauth-token.repository.ts',
        'src/repository/index.ts',
        'src/repositories/user.repository.interface.ts',
        'src/repositories/oauth-token.repository.interface.ts',
        'src/services/user.service.interface.ts',
        'src/services/auth.service.interface.ts',
        'src/types/**',
        'src/models/index.ts',
        // Entry-point / bootstrap files (require full runtime env)
        'src/index.ts',
        // bootstrap / runtime-only (same category as index.ts; vitest v4 newly
        // includes these — they're exercised by integration tests, not unit):
        'src/app.ts',
        'src/container.ts',
        'src/grpc/grpc-server.ts',
      ],
      all: true
    }
  }
});
