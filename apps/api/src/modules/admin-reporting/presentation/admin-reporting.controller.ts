import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminReportingService } from '../application/admin-reporting.service';
import {
  DaysQueryDto,
  MonthsQueryDto,
  TopHotelsQueryDto,
} from './dto/admin-reporting.dto';
import {
  ReportParamsDto,
  ReportQueryDto,
} from '../../admin/presentation/dto/admin.dto';

@ApiTags('admin-reporting')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/reports')
export class AdminReportingController {
  constructor(private readonly reporting: AdminReportingService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform overview counts and revenue' })
  async overview(
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query?.format === 'pdf' || query?.format === 'excel') {
      return this.executeExport('overview', query, res);
    }
    return this.reporting.overview();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Total succeeded revenue grouped by hotel' })
  async revenue(
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query?.format === 'pdf' || query?.format === 'excel') {
      return this.executeExport('revenue', query, res);
    }
    return this.reporting.revenueByHotel();
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Current occupancy rate across rooms' })
  async occupancy(
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query?.format === 'pdf' || query?.format === 'excel') {
      return this.executeExport('occupancy', query, res);
    }
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

  @Get('export/:type')
  @ApiOperation({ summary: 'Export a report as PDF or Excel' })
  async exportReportExplicit(
    @Param() params: ReportParamsDto,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    await this.executeExport(params.type, query, res);
  }

  @Get(':type')
  @ApiOperation({ summary: 'Export a report as PDF or Excel' })
  async exportReport(
    @Param() params: ReportParamsDto,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    await this.executeExport(params.type, query, res);
  }

  private async executeExport(
    type: string,
    query: ReportQueryDto,
    res: Response,
  ) {
    const format = query.format === 'excel' ? 'excel' : 'pdf';
    const { buffer, fileName } = await this.reporting.exportReport(
      type as any,
      format,
      query.period,
      query.startDate,
      query.endDate,
    );
    const contentType =
      format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
