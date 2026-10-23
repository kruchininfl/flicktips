// `pnpm --filter @flicktips/db introspect` pulls the schema from flicktips_test into src/schema.
// The schema of the live database is not changed by drizzle-kit: only `pull` is used.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'mysql',
  schema: './src/schema/index.ts',
  out: './src/schema',
  dbCredentials: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'flicktips_test',
  },
});
