import { z } from 'zod';
export declare const adminHotelStatusSchema: z.ZodEnum<["PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "REJECTED"]>;
export type AdminHotelStatus = z.infer<typeof adminHotelStatusSchema>;
export declare const adminUsersQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    role: z.ZodOptional<z.ZodEnum<["CUSTOMER", "STAFF", "MANAGER", "ADMIN"]>>;
    search: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodEffects<z.ZodEnum<["true", "false"]>, boolean, "true" | "false">>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    role?: "CUSTOMER" | "STAFF" | "MANAGER" | "ADMIN" | undefined;
    search?: string | undefined;
    isActive?: boolean | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    role?: "CUSTOMER" | "STAFF" | "MANAGER" | "ADMIN" | undefined;
    search?: string | undefined;
    isActive?: "true" | "false" | undefined;
}>;
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export declare const updateUserRoleSchema: z.ZodObject<{
    role: z.ZodEnum<["CUSTOMER", "STAFF", "MANAGER", "ADMIN"]>;
}, "strip", z.ZodTypeAny, {
    role: "CUSTOMER" | "STAFF" | "MANAGER" | "ADMIN";
}, {
    role: "CUSTOMER" | "STAFF" | "MANAGER" | "ADMIN";
}>;
export type UpdateUserRole = z.infer<typeof updateUserRoleSchema>;
export declare const setUserActiveSchema: z.ZodObject<{
    isActive: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    reason?: string | undefined;
}, {
    isActive: boolean;
    reason?: string | undefined;
}>;
export type SetUserActive = z.infer<typeof setUserActiveSchema>;
export declare const userIdParamsSchema: z.ZodObject<{
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
}, {
    userId: string;
}>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export declare const adminHotelsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "REJECTED"]>>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "REJECTED" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | undefined;
    search?: string | undefined;
}, {
    status?: "REJECTED" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    search?: string | undefined;
}>;
export type AdminHotelsQuery = z.infer<typeof adminHotelsQuerySchema>;
export declare const updateHotelStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "REJECTED"]>;
    rejectionReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "REJECTED" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED";
    rejectionReason?: string | undefined;
}, {
    status: "REJECTED" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED";
    rejectionReason?: string | undefined;
}>;
export type UpdateHotelStatus = z.infer<typeof updateHotelStatusSchema>;
export declare const rejectHotelSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type RejectHotel = z.infer<typeof rejectHotelSchema>;
export declare const reassignManagerSchema: z.ZodObject<{
    managerId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    managerId: string | null;
}, {
    managerId: string | null;
}>;
export type ReassignManager = z.infer<typeof reassignManagerSchema>;
export declare const adminBookingsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "REJECTED", "NO_SHOW"]>>;
    hotelId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "REJECTED" | "NO_SHOW" | undefined;
    hotelId?: string | undefined;
    userId?: string | undefined;
}, {
    status?: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "REJECTED" | "NO_SHOW" | undefined;
    hotelId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    userId?: string | undefined;
}>;
export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;
export declare const adminPaymentsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["PENDING", "PENDING_AT_HOTEL", "PROCESSING", "OTP_SENT", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "TIMEOUT", "REFUNDED"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "PENDING" | "CANCELLED" | "PENDING_AT_HOTEL" | "PROCESSING" | "OTP_SENT" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "TIMEOUT" | "REFUNDED" | undefined;
}, {
    status?: "PENDING" | "CANCELLED" | "PENDING_AT_HOTEL" | "PROCESSING" | "OTP_SENT" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "TIMEOUT" | "REFUNDED" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type AdminPaymentsQuery = z.infer<typeof adminPaymentsQuerySchema>;
export declare const adminReviewsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    hotelId: z.ZodOptional<z.ZodString>;
    minRating: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    hotelId?: string | undefined;
    minRating?: number | undefined;
}, {
    hotelId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    minRating?: number | undefined;
}>;
export type AdminReviewsQuery = z.infer<typeof adminReviewsQuerySchema>;
export declare const settingParamsSchema: z.ZodObject<{
    key: z.ZodString;
}, "strip", z.ZodTypeAny, {
    key: string;
}, {
    key: string;
}>;
export type SettingParams = z.infer<typeof settingParamsSchema>;
export declare const upsertSettingSchema: z.ZodObject<{
    value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    value: Record<string, unknown>;
}, {
    value: Record<string, unknown>;
}>;
export type UpsertSetting = z.infer<typeof upsertSettingSchema>;
export declare const auditLogsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    entity: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodString>;
    actorId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    entity?: string | undefined;
    action?: string | undefined;
    actorId?: string | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    entity?: string | undefined;
    action?: string | undefined;
    actorId?: string | undefined;
}>;
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
export declare const reportParamsSchema: z.ZodObject<{
    type: z.ZodEnum<["booking", "revenue", "occupancy", "customer", "cancellation"]>;
}, "strip", z.ZodTypeAny, {
    type: "booking" | "revenue" | "occupancy" | "customer" | "cancellation";
}, {
    type: "booking" | "revenue" | "occupancy" | "customer" | "cancellation";
}>;
export type ReportParams = z.infer<typeof reportParamsSchema>;
export declare const reportQuerySchema: z.ZodObject<{
    format: z.ZodDefault<z.ZodEnum<["pdf", "excel"]>>;
}, "strip", z.ZodTypeAny, {
    format: "pdf" | "excel";
}, {
    format?: "pdf" | "excel" | undefined;
}>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
//# sourceMappingURL=admin.d.ts.map