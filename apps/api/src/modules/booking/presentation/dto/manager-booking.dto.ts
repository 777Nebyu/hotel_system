import { createZodDto } from 'nestjs-zod';
import {
  bookingIdParamsSchema,
  decideStayRequestSchema,
  earlyCheckInActionSchema,
  lateCheckOutActionSchema,
  manageBookingsQuerySchema,
  stayRequestIdParamsSchema,
} from '@repo/shared-types';

export class BookingIdParamsDto extends createZodDto(bookingIdParamsSchema) {}
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
