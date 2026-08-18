import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BookingService } from '../application/booking.service';
import {
  BookingIdParamsDto,
  CheckoutDto,
  CreateBookingDto,
  MyBookingsQueryDto,
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
  @ApiOperation({
    summary: 'List the current user bookings, optionally split by scope',
  })
  myBookings(@Query() query: MyBookingsQueryDto, @Req() req: AuthedRequest) {
    return this.bookings.myBookings(req.user.sub, query.scope);
  }

  @Post(':bookingId/cancel')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Cancel a pending or confirmed booking' })
  cancel(@Param() params: BookingIdParamsDto, @Req() req: AuthedRequest) {
    return this.bookings.cancelBooking(params.bookingId, req.user.sub);
  }

  @Get(':bookingId/invoice')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Download the booking invoice as PDF' })
  async invoice(
    @Param() params: BookingIdParamsDto,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    const pdf = await this.bookings.getInvoice(params.bookingId, req.user.sub);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${params.bookingId}.pdf"`,
    );
    res.send(pdf);
  }
}
