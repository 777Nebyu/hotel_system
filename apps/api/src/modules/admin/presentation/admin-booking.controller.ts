import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client';
import { bookingIdParamsSchema } from '@repo/shared-types';
import { createZodDto } from 'nestjs-zod';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminBookingService } from '../application/admin-booking.service';
import { AdminBookingsQueryDto, AdminPaymentsQueryDto } from './dto/admin.dto';

class BookingIdParamsDto extends createZodDto(bookingIdParamsSchema) {}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminBookingController {
  constructor(private readonly bookings: AdminBookingService) {}

  @Get('bookings')
  @ApiOperation({ summary: 'List all bookings with filters' })
  listBookings(@Query() query: AdminBookingsQueryDto) {
    return this.bookings.listBookings(query);
  }

  @Get('bookings/:bookingId')
  @ApiOperation({ summary: 'Get full booking detail' })
  getBooking(@Param() params: BookingIdParamsDto) {
    return this.bookings.getBooking(params.bookingId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List all payments with filters' })
  listPayments(@Query() query: AdminPaymentsQueryDto) {
    return this.bookings.listPayments(query);
  }
}
