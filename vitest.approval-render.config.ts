import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/approvalPolicyRender.optin.ts'],
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 180_000,
    hookTimeout: 120_000
  }
});
