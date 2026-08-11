import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),
  WEB_ORIGIN: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().int().positive().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
});

export type Environment = z.infer<typeof envSchema>;

export const databaseConfigSchema = z.object({ url: z.string().min(1) });
export const jwtConfigSchema = z.object({
  accessSecret: z.string().min(32),
  refreshSecret: z.string().min(32),
  accessTtl: z.string(),
  refreshTtl: z.string(),
});
export const redisConfigSchema = z.object({ url: z.string().min(1) });
export const cloudinaryConfigSchema = z.object({
  cloudName: z.string().optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
});
export const emailConfigSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  user: z.string().optional(),
  pass: z.string().optional(),
  from: z.string().email().optional(),
});

export const appConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  port: z.number().int().positive(),
  webOrigin: z.string().optional(),
  database: databaseConfigSchema,
  jwt: jwtConfigSchema,
  redis: redisConfigSchema,
  cloudinary: cloudinaryConfigSchema,
  email: emailConfigSchema,
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export function configuration(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    webOrigin: env.WEB_ORIGIN,
    database: { url: env.DATABASE_URL },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    redis: { url: env.REDIS_URL },
    cloudinary: {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
    },
    email: {
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
      from: env.EMAIL_FROM,
    },
  };
}
