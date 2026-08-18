import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminReportingService } from '../application/admin-reporting.service';

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
}
