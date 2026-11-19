import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  SESSION_COOKIE_NAME: z.string().default('ahdora_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid API environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export const isProduction = config.NODE_ENV === 'production';