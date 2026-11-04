import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Package-surface tests build and typecheck consumers; bound CPU contention
    // so the complete suite keeps its existing per-test timeout on CI runners.
    maxWorkers: 2,
    restoreMocks: true,
    clearMocks: true
  }
});
