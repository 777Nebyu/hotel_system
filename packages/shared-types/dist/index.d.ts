import { z } from 'zod';
export declare const userRoleSchema: z.ZodEnum<["CUSTOMER", "STAFF", "MANAGER", "ADMIN"]>;
export type UserRole = z.infer<typeof userRoleSchema>;
export declare const passwordSchema: z.ZodString;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    email: string;
    password: string;
    phone?: string | undefined;
}, {
    fullName: string;
    email: string;
    password: string;
    phone?: string | undefined;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export declare const refreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export declare const emailSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export type EmailInput = z.infer<typeof emailSchema>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    password: string;
}, {
    token: string;
    password: string;
}>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export declare const updateProfileSchema: z.ZodEffects<z.ZodObject<{
    fullName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    currentPassword: z.ZodOptional<z.ZodString>;
    newPassword: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fullName?: string | undefined;
    phone?: string | null | undefined;
    currentPassword?: string | undefined;
    newPassword?: string | undefined;
}, {
    fullName?: string | undefined;
    phone?: string | null | undefined;
    currentPassword?: string | undefined;
    newPassword?: string | undefined;
}>, {
    fullName?: string | undefined;
    phone?: string | null | undefined;
    currentPassword?: string | undefined;
    newPassword?: string | undefined;
}, {
    fullName?: string | undefined;
    phone?: string | null | undefined;
    currentPassword?: string | undefined;
    newPassword?: string | undefined;
}>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export declare const userStatusSchema: z.ZodEnum<["ACTIVE", "EMAIL_UNVERIFIED", "SUSPENDED", "DEACTIVATED", "DELETED"]>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export declare const exportQuerySchema: z.ZodObject<{
    type: z.ZodEnum<["bookings", "payments", "reviews", "users"]>;
    format: z.ZodDefault<z.ZodEnum<["csv", "excel"]>>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    hotelId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "bookings" | "payments" | "reviews" | "users";
    format: "excel" | "csv";
    hotelId?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}, {
    type: "bookings" | "payments" | "reviews" | "users";
    hotelId?: string | undefined;
    format?: "excel" | "csv" | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
}>;
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
export declare const deactivateAccountSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>;
export declare const sessionIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;
export declare const flagUserSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type FlagUserInput = z.infer<typeof flagUserSchema>;
export declare const unflagUserSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export type UnflagUserInput = z.infer<typeof unflagUserSchema>;
export * from './catalog';
export * from './booking';
export * from './review';
export * from './notification';
export * from './coupon';
export * from './admin';
export * from './staff';
export * from './contact';
//# sourceMappingURL=index.d.ts.map