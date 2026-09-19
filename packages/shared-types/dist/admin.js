"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportQuerySchema = exports.reportParamsSchema = exports.auditLogsQuerySchema = exports.upsertSettingSchema = exports.settingParamsSchema = exports.adminReviewsQuerySchema = exports.adminPaymentsQuerySchema = exports.adminBookingsQuerySchema = exports.reassignManagerSchema = exports.rejectHotelSchema = exports.updateHotelStatusSchema = exports.adminHotelsQuerySchema = exports.userIdParamsSchema = exports.setUserActiveSchema = exports.updateUserRoleSchema = exports.adminUsersQuerySchema = exports.adminHotelStatusSchema = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const booking_2 = require("./booking");
const id = zod_1.z.string().min(1);
const page = zod_1.z.coerce.number().int().min(1).default(1);
const pageSize = zod_1.z.coerce.number().int().min(1).max(100).default(20);
const userRoleSchema = zod_1.z.enum(['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN']);
exports.adminHotelStatusSchema = zod_1.z.enum([
    'PENDING_APPROVAL',
    'ACTIVE',
    'SUSPENDED',
    'REJECTED',
]);
exports.adminUsersQuerySchema = zod_1.z.object({
    page,
    pageSize,
    role: userRoleSchema.optional(),
    search: zod_1.z.string().max(120).optional(),
    isActive: zod_1.z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
exports.updateUserRoleSchema = zod_1.z.object({
    role: userRoleSchema,
});
exports.setUserActiveSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
    reason: zod_1.z.string().min(1).max(500).optional(),
});
exports.userIdParamsSchema = zod_1.z.object({ userId: id });
exports.adminHotelsQuerySchema = zod_1.z.object({
    page,
    pageSize,
    status: exports.adminHotelStatusSchema.optional(),
    search: zod_1.z.string().max(120).optional(),
});
exports.updateHotelStatusSchema = zod_1.z.object({
    status: exports.adminHotelStatusSchema,
    rejectionReason: zod_1.z.string().min(10).max(500).optional(),
});
exports.rejectHotelSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(500),
});
exports.reassignManagerSchema = zod_1.z.object({
    managerId: zod_1.z.string().min(1).nullable(),
});
exports.adminBookingsQuerySchema = zod_1.z.object({
    page,
    pageSize,
    status: booking_1.bookingStatusSchema.optional(),
    hotelId: id.optional(),
    userId: id.optional(),
});
exports.adminPaymentsQuerySchema = zod_1.z.object({
    page,
    pageSize,
    status: booking_2.paymentStatusSchema.optional(),
});
exports.adminReviewsQuerySchema = zod_1.z.object({
    page,
    pageSize,
    hotelId: id.optional(),
    minRating: zod_1.z.coerce.number().int().min(1).max(5).optional(),
});
exports.settingParamsSchema = zod_1.z.object({ key: zod_1.z.string().min(1).max(64) });
exports.upsertSettingSchema = zod_1.z.object({
    value: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
});
exports.auditLogsQuerySchema = zod_1.z.object({
    page,
    pageSize,
    entity: zod_1.z.string().max(64).optional(),
    action: zod_1.z.string().max(64).optional(),
    actorId: id.optional(),
});
exports.reportParamsSchema = zod_1.z.object({
    type: zod_1.z.enum(['booking', 'revenue', 'occupancy', 'customer', 'cancellation']),
});
exports.reportQuerySchema = zod_1.z.object({
    format: zod_1.z.enum(['pdf', 'excel']).default('pdf'),
});
