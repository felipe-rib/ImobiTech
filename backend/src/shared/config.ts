import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('127.0.0.1'),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_HOURS: z.coerce.number().min(1).max(24).default(8),
});
export function getConfig() {
  const config = schema.parse(process.env);
  if (config.NODE_ENV === 'production' && !config.APP_ORIGIN.startsWith('https://'))
    throw new Error('APP_ORIGIN deve usar HTTPS em produção.');
  return config;
}
export type Config = ReturnType<typeof getConfig>;
