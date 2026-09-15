import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminExportService } from '../application/admin-export.service';
import { ExportQueryDto } from './dto/admin.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('admin (export)')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('admin/export')
export class AdminExportController {
  constructor(private readonly exports: AdminExportService) {}

  @Post()
  @ApiOperation({ summary: 'Export data (bookings, payments, reviews, users) as CSV' })
  async exportData(
    @Body() dto: ExportQueryDto,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ) {
    const result = await this.exports.exportData(dto, req.user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.status(200).send(result.content);
  }
}
