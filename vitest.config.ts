import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
    include: ['src/**/*.ts', 'mcp-server/src/**/*.ts', 'sdk/typescript/src/**/*.ts'],
    exclude: ['**/*.test.ts', '**/types.ts', '**/node_modules/**'],
  },
});
