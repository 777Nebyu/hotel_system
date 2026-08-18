import { z } from 'zod';

export const userRoleSchema = z.enum(['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const passwordSchema = z.string().min(8).max(72);

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  fullName: z.string().min(2).max(120),
  phone: z.string().min(6).max(32).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const emailSchema = z.object({
  email: z.string().email(),
});
export type EmailInput = z.infer<typeof emailSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const forgotPasswordSchema = emailSchema;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export * from './catalog';
export * from './booking';
