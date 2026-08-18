import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ManagerBookingService } from '../application/manager-booking.service';
import {
  BookingIdParamsDto,
  ManageBookingsQueryDto,
} from './dto/manager-booking.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('bookings (manager)')
@ApiBearerAuth()
@Roles(Role.MANAGER, Role.ADMIN)
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
}
