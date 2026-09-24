import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  bookingIdParamsSchema,
  decideStayRequestSchema,
  earlyCheckInActionSchema,
  lateCheckOutActionSchema,
  manageBookingsQuerySchema,
  relocateRoomSchema,
  stayRequestIdParamsSchema,
  createWalkInBookingSchema,
} from '@repo/shared-types';

export class BookingIdParamsDto extends createZodDto(bookingIdParamsSchema) {}
export class RejectBookingDto extends createZodDto(
  z.object({
    reason: z.string().trim().min(1).max(500),
  }),
) {}
export class ManageBookingsQueryDto extends createZodDto(
  manageBookingsQuerySchema,
) {}
export class DecideStayRequestDto extends createZodDto(
  decideStayRequestSchema,
) {}
export class StayRequestIdParamsDto extends createZodDto(
  stayRequestIdParamsSchema,
) {}
export class EarlyCheckInActionDto extends createZodDto(
  earlyCheckInActionSchema,
) {}
export class LateCheckOutActionDto extends createZodDto(
  lateCheckOutActionSchema,
) {}
export class RelocateRoomDto extends createZodDto(relocateRoomSchema) {}
export class CreateWalkInBookingDto extends createZodDto(
  createWalkInBookingSchema,
) {}
