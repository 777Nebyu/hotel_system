import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ResourceScopeHelper } from '../../../common/guards/resource-scope.helper';
import { AdminReportingService } from '../application/admin-reporting.service';
import {
  DaysQueryDto,
  MonthsQueryDto,
} from './dto/admin-reporting.dto';
import {
  ReportParamsDto,
  ReportQueryDto,
} from '../../admin/presentation/dto/admin.dto';

const managerHotelParamsSchema = z.object({
  hotelId: z.string().min(1),
});

class ManagerHotelParamsDto extends createZodDto(managerHotelParamsSchema) {}

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('reports (manager)')
@ApiBearerAuth()
@Roles(Role.MANAGER, Role.ADMIN)
@Controller('manager/hotels/:hotelId/reports')
export class ManagerReportingController {
  constructor(
    private readonly reporting: AdminReportingService,
    private readonly scope: ResourceScopeHelper,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Hotel overview counts and revenue (manager/admin)' })
  async overview(
    @Param() params: ManagerHotelParamsDto,
    @Req() req: AuthedRequest,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );
    return this.reporting.hotelOverview(params.hotelId);
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Hotel occupancy rate (manager/admin)' })
  async occupancy(
    @Param() params: ManagerHotelParamsDto,
    @Req() req: AuthedRequest,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );
    return this.reporting.hotelOccupancyRate(params.hotelId);
  }

  @Get('monthly-revenue')
  @ApiOperation({ summary: 'Monthly revenue series for hotel (manager/admin)' })
  async monthlyRevenue(
    @Param() params: ManagerHotelParamsDto,
    @Query() query: MonthsQueryDto,
    @Req() req: AuthedRequest,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );
    return this.reporting.hotelMonthlyRevenue(params.hotelId, query.months);
  }

  @Get('booking-trends')
  @ApiOperation({ summary: 'Daily booking trends for hotel (manager/admin)' })
  async bookingTrends(
    @Param() params: ManagerHotelParamsDto,
    @Query() query: DaysQueryDto,
    @Req() req: AuthedRequest,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );
    return this.reporting.hotelBookingTrends(params.hotelId, query.days);
  }

  @Get(':type')
  @ApiOperation({ summary: 'Export hotel report as PDF or Excel (manager/admin)' })
  async exportReport(
    @Param() params: ManagerHotelParamsDto,
    @Param() reportParams: ReportParamsDto,
    @Query() query: ReportQueryDto,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );
    const { buffer, fileName } = await this.reporting.exportHotelReport(
      params.hotelId,
      reportParams.type,
      query.format,
    );
    const contentType =
      query.format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
