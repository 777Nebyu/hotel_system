import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminReportingService } from '../application/admin-reporting.service';
import {
  DaysQueryDto,
  MonthsQueryDto,
  TopHotelsQueryDto,
} from './dto/admin-reporting.dto';

@ApiTags('admin-reporting')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/reports')
export class AdminReportingController {
  constructor(private readonly reporting: AdminReportingService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform overview counts and revenue' })
  overview() {
    return this.reporting.overview();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Total succeeded revenue grouped by hotel' })
  revenue() {
    return this.reporting.revenueByHotel();
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Current occupancy rate across rooms' })
  occupancy() {
    return this.reporting.occupancyRate();
  }

  @Get('monthly-revenue')
  @ApiOperation({ summary: 'Monthly succeeded revenue series' })
  monthlyRevenue(@Query() query: MonthsQueryDto) {
    return this.reporting.monthlyRevenue(query.months);
  }

  @Get('booking-trends')
  @ApiOperation({ summary: 'Daily booking creation trend' })
  bookingTrends(@Query() query: DaysQueryDto) {
    return this.reporting.bookingTrends(query.days);
  }

  @Get('most-booked-hotels')
  @ApiOperation({ summary: 'Hotels ranked by booking count' })
  mostBookedHotels(@Query() query: TopHotelsQueryDto) {
    return this.reporting.mostBookedHotels(query.limit);
  }
}
