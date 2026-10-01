import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const timeOnly = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

const tripIdSchema = z.object({ tripId: z.string().min(1) });
const itemParamsSchema = z.object({
  tripId: z.string().min(1),
  itemId: z.string().min(1),
});

const createTripSchema = z.object({
  title: z.string().trim().min(2).max(120),
  startDate: dateOnly,
  endDate: dateOnly,
  hotelId: z.string().min(1).optional(),
  bookingId: z.string().min(1).optional(),
  timezone: z.string().min(1).max(80).default('Africa/Addis_Ababa'),
});

const updateTripSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
  hotelId: z.string().min(1).nullable().optional(),
  timezone: z.string().min(1).max(80).optional(),
});

const createTripItemSchema = z.object({
  dayDate: dateOnly,
  startTime: timeOnly.optional(),
  durationMin: z.number().int().min(1).max(24 * 60).optional(),
  itemType: z.enum(['PLACE', 'BOOKING', 'CUSTOM']),
  placeId: z.string().min(1).optional(),
  bookingId: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(160),
  notes: z.string().max(5000).optional(),
  costAmount: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('ETB'),
  position: z.number().int().min(0).max(10000).default(0),
  createdBy: z.enum(['USER', 'AI']).default('USER'),
  userConfirmed: z.boolean().default(false),
});

const updateTripItemSchema = z.object({
  dayDate: dateOnly.optional(),
  startTime: timeOnly.nullable().optional(),
  durationMin: z.number().int().min(1).max(24 * 60).nullable().optional(),
  title: z.string().trim().min(2).max(160).optional(),
  notes: z.string().max(5000).nullable().optional(),
  costAmount: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(['PLANNED', 'DONE', 'SKIPPED']).optional(),
  position: z.number().int().min(0).max(10000).optional(),
});

const buildDaySchema = z.object({
  dayDate: dateOnly,
  duration: z.enum(['2_HOURS', 'HALF_DAY', 'FULL_DAY']).default('HALF_DAY'),
  startTime: timeOnly.default('09:00'),
  interests: z.array(z.string()).optional(),
});

export class TripIdParamsDto extends createZodDto(tripIdSchema) {}
export class TripItemParamsDto extends createZodDto(itemParamsSchema) {}
export class CreateTripDto extends createZodDto(createTripSchema) {}
export class UpdateTripDto extends createZodDto(updateTripSchema) {}
export class CreateTripItemDto extends createZodDto(createTripItemSchema) {}
export class UpdateTripItemDto extends createZodDto(updateTripItemSchema) {}
export class BuildDayDto extends createZodDto(buildDaySchema) {}

