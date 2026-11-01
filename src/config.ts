import 'dotenv/config';
import { z } from 'zod';

const positive = (fallback: number) => z.coerce.number().int().positive().default(fallback);
const price = z.preprocess(v => v === '' ? undefined : v, z.coerce.number().nonnegative().optional());
const envSchema = z.object({
  DATABASE_URL: z.string().default('file:./prisma/dev.db'),
  HOST: z.string().default('127.0.0.1'), PORT: positive(3000),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_PRIMARY_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_ADVANCED_MODEL: z.string().default('gemini-3.8-flash'),
  AI_PROVIDER: z.literal('gemini').default('gemini'),
  AI_MOCK_MODE: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  AI_MAX_QUESTIONS_PER_REQUEST: positive(10).pipe(z.number().max(10)),
  AI_DAILY_BUDGET_USD: z.coerce.number().nonnegative().default(1),
  AI_PRIMARY_INPUT_USD_PER_MILLION: price, AI_PRIMARY_OUTPUT_USD_PER_MILLION: price,
  AI_ADVANCED_INPUT_USD_PER_MILLION: price, AI_ADVANCED_OUTPUT_USD_PER_MILLION: price,
  AI_TIMEOUT_MS: positive(20000), AI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
  AI_MAX_OUTPUT_TOKENS: positive(8192).pipe(z.number().max(16384)),
  AI_RATE_LIMIT_PER_MINUTE: positive(10), AUTH_CREDENTIALS_JSON: z.string().default('[]'),
});
export type Config = z.infer<typeof envSchema>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => envSchema.parse(env);

export class AppError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message); }
}
