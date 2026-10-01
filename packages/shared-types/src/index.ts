import { z } from 'zod';
import { emailFieldSchema } from './email';

export const userRoleSchema = z.enum(['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Passwords must be long enough and contain a number.  Keep this shared so
// registration, login/reset validation, and the API enforce the same rule.
export const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(/\d/, 'Password must contain at least one number');

export const registerSchema = z.object({
  email: emailFieldSchema,
  password: passwordSchema,
  fullName: z.string().min(2).max(100),
  phone: z.string().min(6).max(32).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const authPortalSchema = z.enum(['CUSTOMER', 'STAFF', 'ADMIN']);
export type AuthPortal = z.infer<typeof authPortalSchema>;

export const loginSchema = z.object({
  email: emailFieldSchema,
  password: passwordSchema,
  // Portal is an authorization hint, never a role claim. The API validates
  // it against the authenticated account role before issuing tokens.
  portal: authPortalSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const mfaCodeSchema = z.string().regex(/^\d{6}$/, 'MFA code must be 6 digits');
export const mfaVerifySchema = z.object({
  challengeToken: z.string().min(32),
  code: mfaCodeSchema,
});
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const emailSchema = z.object({
  email: emailFieldSchema,
});
export type EmailInput = z.infer<typeof emailSchema>;

export const resendVerificationSchema = z.object({
  email: emailFieldSchema,
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z
  .object({
    fullName: z.string().min(2).max(100).optional(),
    phone: z.string().min(6).max(32).nullable().optional(),
    currentPassword: passwordSchema.optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine(
    (d) => !(d.newPassword && !d.currentPassword),
    {
      message: 'currentPassword is required when setting a newPassword',
      path: ['currentPassword'],
    },
  );
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const forgotPasswordSchema = emailSchema;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const userStatusSchema = z.enum([
  'ACTIVE',
  'EMAIL_UNVERIFIED',
  'SUSPENDED',
  'DEACTIVATED',
  'DELETED',
]);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const exportQuerySchema = z.object({
  type: z.enum(['bookings', 'payments', 'reviews', 'users']),
  format: z.enum(['csv', 'excel']).default('csv'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  hotelId: z.string().optional(),
});
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;

export const deactivateAccountSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});
export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>;

export const sessionIdParamsSchema = z.object({
  id: z.string().min(1),
});
export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;

export const flagUserSchema = z.object({
  reason: z.string().min(3).max(500),
});
export type FlagUserInput = z.infer<typeof flagUserSchema>;

export const unflagUserSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});
export type UnflagUserInput = z.infer<typeof unflagUserSchema>;

export * from './email';
export * from './catalog';
export * from './booking';
export * from './review';
export * from './notification';
export * from './coupon';
export * from './admin';
export * from './staff';
export * from './contact';
export * from './ai';
export * from './discover';
