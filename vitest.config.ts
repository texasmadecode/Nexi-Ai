import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules', 'dist', '**/*.test.ts', 'vitest.config.ts'],
    },
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
