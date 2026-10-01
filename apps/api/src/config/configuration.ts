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
  // Absolute base URL of the web app. Used to build links inside emails
  // (verification / password reset). WEB_ORIGIN is a comma-separated CORS
  // allow-list and must never be used verbatim as a link base.
  WEB_APP_URL: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url().optional(),
  ),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.coerce.number().int().positive().optional(),
  ),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().email().optional(),
  ),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_IDS: z.string().optional(),
  MFA_ENCRYPTION_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(['mock', 'chapa']).default('mock'),
  CHAPA_SECRET_KEY: z.string().optional(),
  CHAPA_PUBLIC_KEY: z.string().optional(),
  CHAPA_WEBHOOK_SECRET: z.string().optional(),
  CHAPA_ENCRYPTION_KEY: z.string().optional(),
  CHAPA_BASE_URL: z.string().url().default('https://api.chapa.co/v1'),
  MOCK_PAYMENT_WEBHOOK_SECRET: z
    .string()
    .min(16)
    .default('development-mock-payment-secret'),
  AI_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
  AI_PROVIDER_FALLBACK: z.enum(['mock', 'gemini', 'none']).default('mock'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  AI_CONVERSATION_HISTORY_LIMIT: z.coerce.number().int().positive().default(20),
  AI_MAX_TOOL_ITERATIONS: z.coerce.number().int().positive().default(5),
  AI_RATE_LIMIT_PER_USER: z.coerce.number().int().positive().default(60),
  AI_CONVERSATION_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(90),
  AI_TTS_MODEL: z.string().min(1).default('gemini-2.5-flash-preview-tts'),
  AI_TTS_VOICE: z.string().min(1).default('Kore'),
  AI_RETRY_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_RETRY_BASE_DELAY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(60000)
    .default(400),
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
export const paymentConfigSchema = z.object({
  provider: z.enum(['mock', 'chapa']),
  mockWebhookSecret: z.string().min(16),
  chapaSecretKey: z.string().optional(),
  chapaPublicKey: z.string().optional(),
  chapaWebhookSecret: z.string().optional(),
  chapaBaseUrl: z.string(),
});

export const aiConfigSchema = z.object({
  provider: z.enum(['mock', 'gemini']),
  fallback: z.enum(['mock', 'gemini', 'none']),
  geminiApiKey: z.string().optional(),
  model: z.string().optional(),
  historyLimit: z.number().int().positive(),
  maxToolIterations: z.number().int().positive(),
  rateLimitPerUser: z.number().int().positive(),
  retentionDays: z.number().int().positive(),
  ttsModel: z.string().min(1),
  ttsVoice: z.string().min(1),
  retryMaxRetries: z.number().int().min(0).max(5),
  retryBaseDelayMs: z.number().int().min(0).max(60000),
});

export const appConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  port: z.number().int().positive(),
  webOrigin: z.string().optional(),
  webAppUrl: z.string().url(),
  googleClientId: z.string().optional(),
  googleClientIds: z.array(z.string().min(1)).optional(),
  mfaEncryptionKey: z.string().optional(),
  database: databaseConfigSchema,
  jwt: jwtConfigSchema,
  redis: redisConfigSchema,
  cloudinary: cloudinaryConfigSchema,
  email: emailConfigSchema,
  payment: paymentConfigSchema,
  ai: aiConfigSchema,
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
  if (env.NODE_ENV === 'production') {
    if (!env.WEB_ORIGIN?.trim()) {
      throw new Error('WEB_ORIGIN must be configured in production');
    }
    if (!env.WEB_APP_URL) {
      throw new Error('WEB_APP_URL must be configured in production');
    }
    if (!env.MFA_ENCRYPTION_KEY || env.MFA_ENCRYPTION_KEY.length < 32) {
      throw new Error(
        'MFA_ENCRYPTION_KEY must be at least 32 characters in production',
      );
    }
    for (const origin of env.WEB_ORIGIN.split(',')
      .map((value) => value.trim())
      .filter(Boolean)) {
      let parsedOrigin: URL;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        throw new Error(`Invalid WEB_ORIGIN value: ${origin}`);
      }
      if (
        parsedOrigin.protocol !== 'https:' ||
        parsedOrigin.pathname !== '/' ||
        parsedOrigin.search ||
        parsedOrigin.hash
      ) {
        throw new Error(
          `Production WEB_ORIGIN must be an HTTPS origin: ${origin}`,
        );
      }
    }
  }
  if (
    env.NODE_ENV === 'production' &&
    env.MOCK_PAYMENT_WEBHOOK_SECRET === 'development-mock-payment-secret'
  ) {
    throw new Error(
      'MOCK_PAYMENT_WEBHOOK_SECRET must be changed in production',
    );
  }
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    webOrigin: env.WEB_ORIGIN,
    webAppUrl: (env.WEB_APP_URL ?? 'http://localhost:4000').replace(/\/+$/, ''),
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientIds: (env.GOOGLE_CLIENT_IDS ?? env.GOOGLE_CLIENT_ID ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    mfaEncryptionKey: env.MFA_ENCRYPTION_KEY,
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
    payment: {
      provider: env.PAYMENT_PROVIDER,
      mockWebhookSecret: env.MOCK_PAYMENT_WEBHOOK_SECRET,
      chapaSecretKey: env.CHAPA_SECRET_KEY,
      chapaPublicKey: env.CHAPA_PUBLIC_KEY,
      chapaWebhookSecret: env.CHAPA_WEBHOOK_SECRET || env.CHAPA_ENCRYPTION_KEY,
      chapaBaseUrl: env.CHAPA_BASE_URL,
    },
    ai: {
      provider: env.AI_PROVIDER,
      fallback: env.AI_PROVIDER_FALLBACK,
      geminiApiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      historyLimit: env.AI_CONVERSATION_HISTORY_LIMIT,
      maxToolIterations: env.AI_MAX_TOOL_ITERATIONS,
      rateLimitPerUser: env.AI_RATE_LIMIT_PER_USER,
      retentionDays: env.AI_CONVERSATION_RETENTION_DAYS,
      ttsModel: env.AI_TTS_MODEL,
      ttsVoice: env.AI_TTS_VOICE,
      retryMaxRetries: env.AI_RETRY_MAX_RETRIES,
      retryBaseDelayMs: env.AI_RETRY_BASE_DELAY_MS,
    },
  };
}
