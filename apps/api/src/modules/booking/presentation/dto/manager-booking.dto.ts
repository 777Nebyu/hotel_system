import { createZodDto } from 'nestjs-zod';
import {
  bookingIdParamsSchema,
  manageBookingsQuerySchema,
} from '@repo/shared-types';

export class BookingIdParamsDto extends createZodDto(bookingIdParamsSchema) {}
export class ManageBookingsQueryDto extends createZodDto(
  manageBookingsQuerySchema,
) {}
