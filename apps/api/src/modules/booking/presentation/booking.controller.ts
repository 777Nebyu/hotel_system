import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BookingService } from '../application/booking.service';
import {
  BookingIdParamsDto,
  CheckoutDto,
  CreateBookingDto,
} from './dto/booking.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Preview price and occupancy for a booking' })
  checkout(@Body() dto: CheckoutDto) {
    return this.bookings.checkout(dto);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Create a booking (payment starts as PENDING)' })
  create(@Body() dto: CreateBookingDto, @Req() req: AuthedRequest) {
    return this.bookings.createBooking(dto, req.user.sub);
  }

  @Get('my')
  @ApiOperation({ summary: 'List the current user bookings' })
  myBookings(@Req() req: AuthedRequest) {
    return this.bookings.myBookings(req.user.sub);
  }

  @Post(':bookingId/cancel')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Cancel a pending or confirmed booking' })
  cancel(@Param() params: BookingIdParamsDto, @Req() req: AuthedRequest) {
    return this.bookings.cancelBooking(params.bookingId, req.user.sub);
  }
}
