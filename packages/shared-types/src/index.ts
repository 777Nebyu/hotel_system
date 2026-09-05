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

export const updateProfileSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
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

export * from './catalog';
export * from './booking';
export * from './review';
export * from './notification';
export * from './coupon';
export * from './admin';
export * from './staff';

