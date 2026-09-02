import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ManagerBookingService } from '../application/manager-booking.service';
import { createZodDto } from 'nestjs-zod';
import { hotelIdParamsSchema } from '@repo/shared-types';
import {
  BookingIdParamsDto,
  DecideStayRequestDto,
  EarlyCheckInActionDto,
  LateCheckOutActionDto,
  ManageBookingsQueryDto,
  RelocateRoomDto,
  StayRequestIdParamsDto,
} from './dto/manager-booking.dto';

class HotelIdParamsDto extends createZodDto(hotelIdParamsSchema) {}

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('bookings (manager)')
@ApiBearerAuth()
@Roles(Role.MANAGER, Role.ADMIN, Role.STAFF)
@Controller('bookings')
export class ManagerBookingController {
  constructor(private readonly managerBookings: ManagerBookingService) {}

  @Get('manage')
  @ApiOperation({ summary: 'List bookings across managed hotels' })
  list(@Query() query: ManageBookingsQueryDto, @Req() req: AuthedRequest) {
    return this.managerBookings.listBookings(query, req.user);
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Bookings dashboard stats for managed hotels' })
  stats(@Req() req: AuthedRequest) {
    return this.managerBookings.dashboardStats(req.user);
  }

  @Post(':bookingId/confirm')
  @ApiOperation({ summary: 'Confirm a pending booking' })
  confirm(@Param() params: BookingIdParamsDto, @Req() req: AuthedRequest) {
    return this.managerBookings.confirm(params.bookingId, req.user);
  }

  @Post(':bookingId/reject')
  @ApiOperation({ summary: 'Reject a pending booking' })
  reject(@Param() params: BookingIdParamsDto, @Req() req: AuthedRequest) {
    return this.managerBookings.reject(params.bookingId, req.user);
  }

  @Post(':bookingId/check-in')
  @ApiOperation({ summary: 'Check a confirmed booking in' })
  checkIn(@Param() params: BookingIdParamsDto, @Req() req: AuthedRequest) {
    return this.managerBookings.checkIn(params.bookingId, req.user);
  }

  @Post(':bookingId/check-out')
  @ApiOperation({ summary: 'Check a checked-in booking out' })
  checkOut(@Param() params: BookingIdParamsDto, @Req() req: AuthedRequest) {
    return this.managerBookings.checkOut(params.bookingId, req.user);
  }

  @Post(':bookingId/early-checkin')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Direct staff/manager approval for early check-in' })
  earlyCheckIn(
    @Param() params: BookingIdParamsDto,
    @Body() dto: EarlyCheckInActionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.managerBookings.directEarlyCheckIn(params.bookingId, dto, req.user);
  }

  @Post(':bookingId/late-checkout')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Direct staff/manager approval for late check-out' })
  lateCheckOut(
    @Param() params: BookingIdParamsDto,
    @Body() dto: LateCheckOutActionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.managerBookings.directLateCheckOut(params.bookingId, dto, req.user);
  }

  @Get('hotels/:id/stay-requests')
  @ApiOperation({ summary: 'List stay requests for a hotel' })
  listStayRequests(
    @Param() params: HotelIdParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.managerBookings.listStayRequests(params.id, req.user);
  }

  @Post('stay-requests/:id/decide')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Approve or reject a stay request' })
  decideStayRequest(
    @Param() params: StayRequestIdParamsDto,
    @Body() dto: DecideStayRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.managerBookings.decideStayRequest(params.id, dto, req.user);
  }

  @Post(':bookingId/no-show')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Mark a confirmed booking as no-show' })
  noShow(
    @Param() params: BookingIdParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.managerBookings.manualNoShow(params.bookingId, req.user);
  }

  @Post(':bookingId/relocate-room')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Relocate a checked-in guest to another room' })
  relocateRoom(
    @Param() params: BookingIdParamsDto,
    @Body() dto: RelocateRoomDto,
    @Req() req: AuthedRequest,
  ) {
    return this.managerBookings.relocateRoom(params.bookingId, dto, req.user);
  }
}
