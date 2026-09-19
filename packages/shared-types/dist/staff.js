"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suspensionIdParamsSchema = exports.decideSuspensionSchema = exports.requestSuspensionSchema = exports.disputeQuerySchema = exports.disputeIdParamsSchema = exports.disputeStatusSchema = exports.resolveDisputeSchema = exports.createDisputeSchema = exports.hotelStaffQuerySchema = exports.staffHotelParamsSchema = exports.assignStaffSchema = void 0;
const zod_1 = require("zod");
const id = zod_1.z.string().min(1);
exports.assignStaffSchema = zod_1.z.object({
    staffId: id,
});
exports.staffHotelParamsSchema = zod_1.z.object({
    hotelId: id,
    staffId: id,
});
exports.hotelStaffQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.createDisputeSchema = zod_1.z.object({
    bookingId: id,
    reason: zod_1.z.string().min(10).max(2000),
});
exports.resolveDisputeSchema = zod_1.z.object({
    resolution: zod_1.z.string().min(5).max(2000),
});
exports.disputeStatusSchema = zod_1.z.enum([
    'OPEN',
    'UNDER_REVIEW',
    'RESOLVED',
    'CLOSED',
]);
exports.disputeIdParamsSchema = zod_1.z.object({ id });
exports.disputeQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    status: exports.disputeStatusSchema.optional(),
});
exports.requestSuspensionSchema = zod_1.z.object({
    targetType: zod_1.z.enum(['USER', 'HOTEL']),
    targetId: id,
    reason: zod_1.z.string().min(10).max(1000),
});
exports.decideSuspensionSchema = zod_1.z.object({
    decision: zod_1.z.enum(['APPROVED', 'REJECTED']),
});
exports.suspensionIdParamsSchema = zod_1.z.object({ id });
