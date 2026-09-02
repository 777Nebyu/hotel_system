import { createZodDto } from 'nestjs-zod';
import {
  bookingIdParamsSchema,
  cancelRoomSchema,
  checkoutSchema,
  createBookingSchema,
  createRoomHoldSchema,
  createStayRequestSchema,
  myBookingsQuerySchema,
  roomHoldIdParamsSchema,
} from '@repo/shared-types';

export class CheckoutDto extends createZodDto(checkoutSchema) {}
export class CreateBookingDto extends createZodDto(createBookingSchema) {}
export class BookingIdParamsDto extends createZodDto(bookingIdParamsSchema) {}
export class MyBookingsQueryDto extends createZodDto(myBookingsQuerySchema) {}
export class CancelRoomsDto extends createZodDto(cancelRoomSchema) {}
export class CreateRoomHoldDto extends createZodDto(createRoomHoldSchema) {}
export class RoomHoldIdParamsDto extends createZodDto(roomHoldIdParamsSchema) {}
export class CreateStayRequestDto extends createZodDto(createStayRequestSchema) {}
