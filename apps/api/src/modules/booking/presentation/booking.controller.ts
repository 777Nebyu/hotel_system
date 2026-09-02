import {
  Body,
  Controller,
  Delete,
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
  CancelRoomsDto,
  CheckoutDto,
  CreateBookingDto,
  CreateRoomHoldDto,
  CreateStayRequestDto,
  MyBookingsQueryDto,
  RoomHoldIdParamsDto,
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
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
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

  @Post(':bookingId/cancel-rooms')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary:
      'Cancel one or more specific rooms from a multi-room booking (rule 46)',
  })
  cancelRooms(
    @Param() params: BookingIdParamsDto,
    @Body() dto: CancelRoomsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.bookings.cancelRooms(params.bookingId, dto, req.user.sub);
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

  @Post('holds')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Place a 15-minute temporary hold on a room during checkout' })
  createHold(@Body() dto: CreateRoomHoldDto, @Req() req: AuthedRequest) {
    return this.bookings.createHold(dto, req.user.sub);
  }

  @Delete('holds/:holdId')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Release a temporary room hold' })
  releaseHold(@Param() params: RoomHoldIdParamsDto, @Req() req: AuthedRequest) {
    return this.bookings.releaseHold(params.holdId, req.user.sub);
  }

  @Post(':bookingId/stay-requests')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Request early check-in or late check-out for a booking' })
  createStayRequest(
    @Param() params: BookingIdParamsDto,
    @Body() dto: CreateStayRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.bookings.createStayRequest(params.bookingId, dto, req.user.sub);
  }

  @Get(':bookingId/stay-requests')
  @ApiOperation({ summary: 'Get stay requests for a booking' })
  getStayRequests(@Param() params: BookingIdParamsDto, @Req() req: AuthedRequest) {
    return this.bookings.getStayRequests(params.bookingId, req.user.sub);
  }
}
