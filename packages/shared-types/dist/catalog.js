"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityWindowSchema = exports.searchHotelsSchema = exports.hotelSortSchema = exports.attachAmenitySchema = exports.upsertHotelPolicySchema = exports.blockMaintenanceSchema = exports.availabilityBulkSchema = exports.seasonalPricingSchema = exports.updateRoomSchema = exports.createRoomSchema = exports.updateHotelSchema = exports.createHotelSchema = exports.roomImageParamsSchema = exports.roomAmenityParamsSchema = exports.hotelAmenityParamsSchema = exports.seasonalPricingParamsSchema = exports.imageIdParamsSchema = exports.amenityIdParamsSchema = exports.roomIdParamsSchema = exports.hotelIdParamsSchema = exports.hotelStatusSchema = exports.updateRoomStatusSchema = exports.roomStatusSchema = exports.roomTypeSchema = void 0;
const zod_1 = require("zod");
exports.roomTypeSchema = zod_1.z.enum([
    'STANDARD',
    'DELUXE',
    'SUITE',
    'FAMILY',
    'EXECUTIVE',
]);
exports.roomStatusSchema = zod_1.z.enum([
    'AVAILABLE',
    'UNAVAILABLE',
    'MAINTENANCE',
    'CLEANING',
]);
exports.updateRoomStatusSchema = zod_1.z.object({
    status: exports.roomStatusSchema,
});
exports.hotelStatusSchema = zod_1.z.enum([
    'PENDING_APPROVAL',
    'ACTIVE',
    'SUSPENDED',
    'REJECTED',
]);
const id = zod_1.z.string().min(1);
exports.hotelIdParamsSchema = zod_1.z.object({ id });
exports.roomIdParamsSchema = zod_1.z.object({ roomId: id });
exports.amenityIdParamsSchema = zod_1.z.object({ amenityId: id });
exports.imageIdParamsSchema = zod_1.z.object({ imageId: id, id });
exports.seasonalPricingParamsSchema = zod_1.z.object({
    roomId: id,
    pricingId: id,
});
exports.hotelAmenityParamsSchema = zod_1.z.object({ id, amenityId: id });
exports.roomAmenityParamsSchema = zod_1.z.object({ roomId: id, amenityId: id });
exports.roomImageParamsSchema = zod_1.z.object({ roomId: id, imageId: id });
exports.createHotelSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    description: zod_1.z.string().min(10).max(2000),
    cityId: id,
    address: zod_1.z.string().min(3).max(255),
    lat: zod_1.z.number().min(-90).max(90).optional(),
    lng: zod_1.z.number().min(-180).max(180).optional(),
    starRating: zod_1.z.number().int().min(1).max(5).default(3),
    status: exports.hotelStatusSchema.default('PENDING_APPROVAL'),
    managerId: id.optional(),
});
exports.updateHotelSchema = exports.createHotelSchema.partial().extend({
    rejectionReason: zod_1.z.string().max(500).nullable().optional(),
});
exports.createRoomSchema = zod_1.z.object({
    roomNumber: zod_1.z.string().min(1).max(20),
    type: exports.roomTypeSchema,
    capacity: zod_1.z.preprocess((v) => Number(v), zod_1.z.number().int().min(1).max(50)),
    beds: zod_1.z.preprocess((v) => Number(v), zod_1.z.number().int().min(1).max(20)).default(1),
    bathroom: zod_1.z
        .preprocess((v) => Number(v), zod_1.z.number().int().min(0).max(10))
        .default(1),
    basePrice: zod_1.z.preprocess((v) => Number(v), zod_1.z.coerce.number().positive().multipleOf(0.01)),
    status: exports.roomStatusSchema.default('AVAILABLE'),
    description: zod_1.z.string().max(2000).optional(),
});
exports.updateRoomSchema = exports.createRoomSchema.partial();
exports.seasonalPricingSchema = zod_1.z
    .object({
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
    priceOverride: zod_1.z.coerce.number().positive().multipleOf(0.01),
})
    .refine((d) => d.endDate >= d.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
});
exports.availabilityBulkSchema = zod_1.z.object({
    dates: zod_1.z.array(zod_1.z.coerce.date()).min(1).max(366),
    status: exports.roomStatusSchema,
});
exports.blockMaintenanceSchema = zod_1.z
    .object({
    roomId: id.optional(),
    roomIds: zod_1.z.array(id).min(1).max(50).optional(),
    startDate: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date(),
    reason: zod_1.z.string().max(500).optional(),
})
    .refine((d) => d.endDate >= d.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
})
    .refine((d) => Boolean(d.roomId || (d.roomIds && d.roomIds.length > 0)), {
    message: 'Either roomId or roomIds must be provided',
    path: ['roomId'],
});
exports.upsertHotelPolicySchema = zod_1.z.object({
    checkInTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm').default('14:00'),
    checkOutTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm').default('11:00'),
    cancellationWindowDays: zod_1.z.coerce.number().int().min(0).max(90).default(3),
    cancellationFeePercent: zod_1.z.coerce.number().min(0).max(100).default(0),
    allowEarlyCheckIn: zod_1.z.boolean().default(true),
    earlyCheckInFee: zod_1.z.coerce.number().min(0).default(0),
    allowLateCheckOut: zod_1.z.boolean().default(true),
    lateCheckOutFee: zod_1.z.coerce.number().min(0).default(0),
});
exports.attachAmenitySchema = zod_1.z.object({ amenityId: id });
exports.hotelSortSchema = zod_1.z.enum([
    'price_asc',
    'price_desc',
    'rating_desc',
    'popularity',
]);
exports.searchHotelsSchema = zod_1.z.object({
    city: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    priceMin: zod_1.z.coerce.number().nonnegative().optional(),
    priceMax: zod_1.z.coerce.number().positive().optional(),
    minRating: zod_1.z.preprocess((v) => (v === undefined || v === '' ? undefined : Number(v)), zod_1.z.number().min(0).max(5).optional()),
    roomType: exports.roomTypeSchema.optional(),
    amenities: zod_1.z
        .union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())])
        .optional()
        .transform((v) => v
        ? (Array.isArray(v) ? v : [v])
            .flatMap((x) => x.split(','))
            .map((x) => x.trim())
            .filter(Boolean)
        : undefined),
    sort: exports.hotelSortSchema.default('popularity'),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.availabilityWindowSchema = zod_1.z
    .object({
    checkIn: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be YYYY-MM-DD'),
    checkOut: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be YYYY-MM-DD'),
})
    .refine((d) => d.checkOut > d.checkIn, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
});
