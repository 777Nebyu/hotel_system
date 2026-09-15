import { z } from 'zod';

const id = z.string().min(1);

export const discountTypeSchema = z.enum(['PERCENTAGE', 'FIXED_AMOUNT']);
export type DiscountType = z.infer<typeof discountTypeSchema>;

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(20)
      .transform((value) => value.toUpperCase()),
    discountType: discountTypeSchema.default('PERCENTAGE'),
    value: z.coerce.number().positive().multipleOf(0.01),
    validFrom: z.coerce.date(),
    validTo: z.coerce.date(),
    usageLimit: z.coerce.number().int().min(1).default(100),
    minBookingAmount: z.coerce.number().positive().multipleOf(0.01).optional(),
  })
  .refine((d) => d.validTo >= d.validFrom, {
    message: 'validTo must be on or after validFrom',
    path: ['validTo'],
  })
  .refine((d) => d.discountType !== 'PERCENTAGE' || d.value <= 100, {
    message: 'percentage value must be at most 100',
    path: ['value'],
  });
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

export const updateCouponSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(20)
      .transform((value) => value.toUpperCase())
      .optional(),
    discountType: discountTypeSchema.optional(),
    value: z.coerce.number().positive().multipleOf(0.01).optional(),
    validFrom: z.coerce.date().optional(),
    validTo: z.coerce.date().optional(),
    usageLimit: z.coerce.number().int().min(1).optional(),
    isActive: z.boolean().optional(),
    minBookingAmount: z.coerce.number().positive().multipleOf(0.01).nullable().optional(),
  })
  .refine(
    (d) =>
      d.validFrom === undefined ||
      d.validTo === undefined ||
      d.validTo >= d.validFrom,
    { message: 'validTo must be on or after validFrom', path: ['validTo'] },
  )
  .refine(
    (d) => d.discountType !== 'PERCENTAGE' || d.value === undefined || d.value <= 100,
    { message: 'percentage value must be at most 100', path: ['value'] },
  );
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

export const couponIdParamsSchema = z.object({ id });
export type CouponIdParams = z.infer<typeof couponIdParamsSchema>;