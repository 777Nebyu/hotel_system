import { createZodDto } from 'nestjs-zod';
import {
  couponIdParamsSchema,
  createCouponSchema,
  updateCouponSchema,
} from '@repo/shared-types';

export class CreateCouponDto extends createZodDto(createCouponSchema) {}
export class UpdateCouponDto extends createZodDto(updateCouponSchema) {}
export class CouponIdParamsDto extends createZodDto(couponIdParamsSchema) {}
