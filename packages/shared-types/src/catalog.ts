import { z } from 'zod';

export const roomTypeSchema = z.enum([
  'STANDARD',
  'DELUXE',
  'SUITE',
  'FAMILY',
  'EXECUTIVE',
]);
export type RoomType = z.infer<typeof roomTypeSchema>;

export const roomStatusSchema = z.enum([
  'AVAILABLE',
  'UNAVAILABLE',
  'MAINTENANCE',
]);
export type RoomStatus = z.infer<typeof roomStatusSchema>;

export const hotelStatusSchema = z.enum([
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'REJECTED',
]);
export type HotelStatus = z.infer<typeof hotelStatusSchema>;

const id = z.string().min(1);

export const hotelIdParamsSchema = z.object({ id });
export type HotelIdParams = z.infer<typeof hotelIdParamsSchema>;

export const roomIdParamsSchema = z.object({ roomId: id });
export type RoomIdParams = z.infer<typeof roomIdParamsSchema>;

export const amenityIdParamsSchema = z.object({ amenityId: id });
export type AmenityIdParams = z.infer<typeof amenityIdParamsSchema>;

export const imageIdParamsSchema = z.object({ imageId: id, id });
export type ImageIdParams = z.infer<typeof imageIdParamsSchema>;

export const seasonalPricingParamsSchema = z.object({
  roomId: id,
  pricingId: id,
});
export type SeasonalPricingParams = z.infer<typeof seasonalPricingParamsSchema>;

export const hotelAmenityParamsSchema = z.object({ id, amenityId: id });
export type HotelAmenityParams = z.infer<typeof hotelAmenityParamsSchema>;

export const roomAmenityParamsSchema = z.object({ roomId: id, amenityId: id });
export type RoomAmenityParams = z.infer<typeof roomAmenityParamsSchema>;

export const roomImageParamsSchema = z.object({ roomId: id, imageId: id });
export type RoomImageParams = z.infer<typeof roomImageParamsSchema>;

export const createHotelSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(10).max(2000),
  cityId: id,
  address: z.string().min(3).max(255),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  starRating: z.number().int().min(1).max(5).default(3),
  status: hotelStatusSchema.default('PENDING_APPROVAL'),
  managerId: id.optional(),
});
export type CreateHotelInput = z.infer<typeof createHotelSchema>;

export const updateHotelSchema = createHotelSchema.partial().extend({
  rejectionReason: z.string().max(500).nullable().optional(),
});
export type UpdateHotelInput = z.infer<typeof updateHotelSchema>;

export const createRoomSchema = z.object({
  roomNumber: z.string().min(1).max(20),
  type: roomTypeSchema,
  capacity: z.preprocess((v) => Number(v), z.number().int().min(1).max(50)),
  beds: z.preprocess((v) => Number(v), z.number().int().min(1).max(20)).default(1),
  bathroom: z
    .preprocess((v) => Number(v), z.number().int().min(0).max(10))
    .default(1),
  basePrice: z.preprocess(
    (v) => Number(v),
    z.coerce.number().positive().multipleOf(0.01),
  ),
  status: roomStatusSchema.default('AVAILABLE'),
  description: z.string().max(2000).optional(),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const updateRoomSchema = createRoomSchema.partial();
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

export const seasonalPricingSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    priceOverride: z.coerce.number().positive().multipleOf(0.01),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });
export type SeasonalPricingInput = z.infer<typeof seasonalPricingSchema>;

export const availabilityBulkSchema = z.object({
  dates: z.array(z.coerce.date()).min(1).max(366),
  status: roomStatusSchema,
});
export type AvailabilityBulkInput = z.infer<typeof availabilityBulkSchema>;

export const blockMaintenanceSchema = z
  .object({
    roomId: id.optional(),
    roomIds: z.array(id).min(1).max(50).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().max(500).optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  })
  .refine((d) => Boolean(d.roomId || (d.roomIds && d.roomIds.length > 0)), {
    message: 'Either roomId or roomIds must be provided',
    path: ['roomId'],
  });
export type BlockMaintenanceInput = z.infer<typeof blockMaintenanceSchema>;

export const upsertHotelPolicySchema = z.object({
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm').default('14:00'),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm').default('11:00'),
  cancellationWindowDays: z.coerce.number().int().min(0).max(90).default(3),
  cancellationFeePercent: z.coerce.number().min(0).max(100).default(0),
  allowEarlyCheckIn: z.boolean().default(true),
  earlyCheckInFee: z.coerce.number().min(0).default(0),
  allowLateCheckOut: z.boolean().default(true),
  lateCheckOutFee: z.coerce.number().min(0).default(0),
});
export type UpsertHotelPolicyInput = z.infer<typeof upsertHotelPolicySchema>;

export const attachAmenitySchema = z.object({ amenityId: id });
export type AttachAmenityInput = z.infer<typeof attachAmenitySchema>;

export const hotelSortSchema = z.enum([
  'price_asc',
  'price_desc',
  'rating_desc',
  'popularity',
]);
export type HotelSort = z.infer<typeof hotelSortSchema>;

export const searchHotelsSchema = z.object({
  city: z.string().optional(),
  country: z.string().optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().positive().optional(),
  minRating: z.preprocess(
    (v) => (v === undefined || v === '' ? undefined : Number(v)),
    z.number().min(0).max(5).optional(),
  ),
  roomType: roomTypeSchema.optional(),
  amenities: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) =>
      v
        ? (Array.isArray(v) ? v : [v])
            .flatMap((x) => x.split(','))
            .map((x) => x.trim())
            .filter(Boolean)
        : undefined,
    ),
  sort: hotelSortSchema.default('popularity'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchHotelsQuery = z.infer<typeof searchHotelsSchema>;

export const availabilityWindowSchema = z
  .object({
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be YYYY-MM-DD'),
    checkOut: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be YYYY-MM-DD'),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
  });
export type AvailabilityWindow = z.infer<typeof availabilityWindowSchema>;

export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}