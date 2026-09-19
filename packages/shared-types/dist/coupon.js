"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponIdParamsSchema = exports.updateCouponSchema = exports.createCouponSchema = exports.discountTypeSchema = void 0;
const zod_1 = require("zod");
const id = zod_1.z.string().min(1);
exports.discountTypeSchema = zod_1.z.enum(['PERCENTAGE', 'FIXED_AMOUNT']);
exports.createCouponSchema = zod_1.z
    .object({
    code: zod_1.z
        .string()
        .min(3)
        .max(20)
        .transform((value) => value.toUpperCase()),
    discountType: exports.discountTypeSchema.default('PERCENTAGE'),
    value: zod_1.z.coerce.number().positive().multipleOf(0.01),
    validFrom: zod_1.z.coerce.date(),
    validTo: zod_1.z.coerce.date(),
    usageLimit: zod_1.z.coerce.number().int().min(1).default(100),
    minBookingAmount: zod_1.z.coerce.number().positive().multipleOf(0.01).optional(),
})
    .refine((d) => d.validTo >= d.validFrom, {
    message: 'validTo must be on or after validFrom',
    path: ['validTo'],
})
    .refine((d) => d.discountType !== 'PERCENTAGE' || d.value <= 100, {
    message: 'percentage value must be at most 100',
    path: ['value'],
});
exports.updateCouponSchema = zod_1.z
    .object({
    code: zod_1.z
        .string()
        .min(3)
        .max(20)
        .transform((value) => value.toUpperCase())
        .optional(),
    discountType: exports.discountTypeSchema.optional(),
    value: zod_1.z.coerce.number().positive().multipleOf(0.01).optional(),
    validFrom: zod_1.z.coerce.date().optional(),
    validTo: zod_1.z.coerce.date().optional(),
    usageLimit: zod_1.z.coerce.number().int().min(1).optional(),
    isActive: zod_1.z.boolean().optional(),
    minBookingAmount: zod_1.z.coerce.number().positive().multipleOf(0.01).nullable().optional(),
})
    .refine((d) => d.validFrom === undefined ||
    d.validTo === undefined ||
    d.validTo >= d.validFrom, { message: 'validTo must be on or after validFrom', path: ['validTo'] })
    .refine((d) => d.discountType !== 'PERCENTAGE' || d.value === undefined || d.value <= 100, { message: 'percentage value must be at most 100', path: ['value'] });
exports.couponIdParamsSchema = zod_1.z.object({ id });
