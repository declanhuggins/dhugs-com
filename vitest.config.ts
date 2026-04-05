import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // E2E tests share a single Vibium browser daemon — must run sequentially
    fileParallelism: false,
  },
});
