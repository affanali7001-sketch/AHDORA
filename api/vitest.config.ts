import { defineConfig } from 'vitest/config';

/**
 * Tests run without a real MongoDB or SMTP server. The API config
 * requires MONGODB_URI, so a dummy value is provided here — no test
 * in this suite ever opens a database connection (all tests are pure
 * functions; the config is only pulled in transitively by email.ts).
 * SMTP stays unset on purpose, so the honest not-configured email
 * path is what gets tested.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/ahdora-test',
    },
  },
});
