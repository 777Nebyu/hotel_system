import { z } from 'zod';
export declare const discountTypeSchema: z.ZodEnum<["PERCENTAGE", "FIXED_AMOUNT"]>;
export type DiscountType = z.infer<typeof discountTypeSchema>;
export declare const createCouponSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    code: z.ZodEffects<z.ZodString, string, string>;
    discountType: z.ZodDefault<z.ZodEnum<["PERCENTAGE", "FIXED_AMOUNT"]>>;
    value: z.ZodNumber;
    validFrom: z.ZodDate;
    validTo: z.ZodDate;
    usageLimit: z.ZodDefault<z.ZodNumber>;
    minBookingAmount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    value: number;
    code: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    validFrom: Date;
    validTo: Date;
    usageLimit: number;
    minBookingAmount?: number | undefined;
}, {
    value: number;
    code: string;
    validFrom: Date;
    validTo: Date;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | undefined;
    usageLimit?: number | undefined;
    minBookingAmount?: number | undefined;
}>, {
    value: number;
    code: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    validFrom: Date;
    validTo: Date;
    usageLimit: number;
    minBookingAmount?: number | undefined;
}, {
    value: number;
    code: string;
    validFrom: Date;
    validTo: Date;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | undefined;
    usageLimit?: number | undefined;
    minBookingAmount?: number | undefined;
}>, {
    value: number;
    code: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    validFrom: Date;
    validTo: Date;
    usageLimit: number;
    minBookingAmount?: number | undefined;
}, {
    value: number;
    code: string;
    validFrom: Date;
    validTo: Date;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | undefined;
    usageLimit?: number | undefined;
    minBookingAmount?: number | undefined;
}>;
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export declare const updateCouponSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    code: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    discountType: z.ZodOptional<z.ZodEnum<["PERCENTAGE", "FIXED_AMOUNT"]>>;
    value: z.ZodOptional<z.ZodNumber>;
    validFrom: z.ZodOptional<z.ZodDate>;
    validTo: z.ZodOptional<z.ZodDate>;
    usageLimit: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    minBookingAmount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    value?: number | undefined;
    code?: string | undefined;
    isActive?: boolean | undefined;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | undefined;
    validFrom?: Date | undefined;
    validTo?: Date | undefined;
    usageLimit?: number | undefined;
    minBookingAmount?: number | null | undefined;
}, {
    value?: number | undefined;
    code?: string | undefined;
    isActive?: boolean | undefined;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | undefined;
    validFrom?: Date | undefined;
    validTo?: Date | undefined;
    usageLimit?: number | undefined;
    minBookingAmount?: number | null | undefined;
}>, {
    value?: number | undefined;
    code?: string | undefined;
    isActive?: boolean | undefined;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | undefined;
    validFrom?: Date | undefined;
    validTo?: Date | undefined;
    usageLimit?: number | undefined;
    minBookingAmount?: number | null | undefined;
}, {
    value?: number | undefined;
    code?: string | undefined;
    isActive?: boolean | undefined;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | undefined;
    validFrom?: Date | undefined;
    validTo?: Date | undefined;
    usageLimit?: number | undefined;
    minBookingAmount?: number | null | undefined;
}>, {
    value?: number | undefined;
    code?: string | undefined;
    isActive?: boolean | undefined;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | undefined;
    validFrom?: Date | undefined;
    validTo?: Date | undefined;
    usageLimit?: number | undefined;
    minBookingAmount?: number | null | undefined;
}, {
    value?: number | undefined;
    code?: string | undefined;
    isActive?: boolean | undefined;
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | undefined;
    validFrom?: Date | undefined;
    validTo?: Date | undefined;
    usageLimit?: number | undefined;
    minBookingAmount?: number | null | undefined;
}>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export declare const couponIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type CouponIdParams = z.infer<typeof couponIdParamsSchema>;
//# sourceMappingURL=coupon.d.ts.map