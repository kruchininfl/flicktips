import { defineConfig } from 'vitest/config';

// Unit tests of the plain TS helpers (src/**/*.test.ts); pages and components are checked in a browser.
export default defineConfig({
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: { include: ['src/**/*.test.ts'] },
});
