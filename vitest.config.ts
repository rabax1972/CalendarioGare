import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scraper/test/**/*.test.ts', 'web/**/*.test.ts'],
  },
});
