import { createZodDto } from 'nestjs-zod';
import {
  bookingIdParamsSchema,
  checkoutSchema,
  createBookingSchema,
} from '@repo/shared-types';

export class CheckoutDto extends createZodDto(checkoutSchema) {}
export class CreateBookingDto extends createZodDto(createBookingSchema) {}
export class BookingIdParamsDto extends createZodDto(bookingIdParamsSchema) {}
