"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactThreadIdParamsSchema = exports.updateContactStatusSchema = exports.sendContactMessageSchema = exports.createContactThreadSchema = exports.contactStatusSchema = void 0;
const zod_1 = require("zod");
const id = zod_1.z.string().min(1);
exports.contactStatusSchema = zod_1.z.enum(['OPEN', 'CLOSED']);
exports.createContactThreadSchema = zod_1.z.object({
    subject: zod_1.z.string().min(3).max(200),
    message: zod_1.z.string().min(2).max(4000),
    bookingId: id.optional(),
});
exports.sendContactMessageSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(4000),
});
exports.updateContactStatusSchema = zod_1.z.object({
    status: exports.contactStatusSchema,
});
exports.contactThreadIdParamsSchema = zod_1.z.object({
    threadId: id,
});
