import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default('development'),
  CLOUDINARY_API_KEY: z.string().optional().default('development'),
  CLOUDINARY_API_SECRET: z.string().optional().default('development'),
  SMTP_HOST: z.string().optional().default('localhost'),
  SMTP_PORT: z.coerce.number().optional().default(1025),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default('noreply@yayetech.com'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Config validation error: Invalid environment variables');
  }
  return result.data;
}
