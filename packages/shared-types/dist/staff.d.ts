import { z } from 'zod';
export declare const assignStaffSchema: z.ZodObject<{
    staffId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    staffId: string;
}, {
    staffId: string;
}>;
export type AssignStaffInput = z.infer<typeof assignStaffSchema>;
export declare const staffHotelParamsSchema: z.ZodObject<{
    hotelId: z.ZodString;
    staffId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    hotelId: string;
    staffId: string;
}, {
    hotelId: string;
    staffId: string;
}>;
export type StaffHotelParams = z.infer<typeof staffHotelParamsSchema>;
export declare const hotelStaffQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type HotelStaffQuery = z.infer<typeof hotelStaffQuerySchema>;
export declare const createDisputeSchema: z.ZodObject<{
    bookingId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    bookingId: string;
    reason: string;
}, {
    bookingId: string;
    reason: string;
}>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export declare const resolveDisputeSchema: z.ZodObject<{
    resolution: z.ZodString;
}, "strip", z.ZodTypeAny, {
    resolution: string;
}, {
    resolution: string;
}>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
export declare const disputeStatusSchema: z.ZodEnum<["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"]>;
export type DisputeStatusType = z.infer<typeof disputeStatusSchema>;
export declare const disputeIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type DisputeIdParams = z.infer<typeof disputeIdParamsSchema>;
export declare const disputeQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "OPEN" | "CLOSED" | "UNDER_REVIEW" | "RESOLVED" | undefined;
}, {
    status?: "OPEN" | "CLOSED" | "UNDER_REVIEW" | "RESOLVED" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type DisputeQuery = z.infer<typeof disputeQuerySchema>;
export declare const requestSuspensionSchema: z.ZodObject<{
    targetType: z.ZodEnum<["USER", "HOTEL"]>;
    targetId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    targetType: "USER" | "HOTEL";
    targetId: string;
}, {
    reason: string;
    targetType: "USER" | "HOTEL";
    targetId: string;
}>;
export type RequestSuspensionInput = z.infer<typeof requestSuspensionSchema>;
export declare const decideSuspensionSchema: z.ZodObject<{
    decision: z.ZodEnum<["APPROVED", "REJECTED"]>;
}, "strip", z.ZodTypeAny, {
    decision: "REJECTED" | "APPROVED";
}, {
    decision: "REJECTED" | "APPROVED";
}>;
export type DecideSuspensionInput = z.infer<typeof decideSuspensionSchema>;
export declare const suspensionIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type SuspensionIdParams = z.infer<typeof suspensionIdParamsSchema>;
//# sourceMappingURL=staff.d.ts.map