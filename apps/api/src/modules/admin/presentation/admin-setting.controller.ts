import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminSettingService } from '../application/admin-setting.service';
import {
  AuditLogsQueryDto,
  SettingParamsDto,
  UpsertSettingDto,
} from './dto/admin.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminSettingController {
  constructor(private readonly settings: AdminSettingService) {}

  @Get('settings')
  @ApiOperation({ summary: 'List platform settings' })
  listSettings() {
    return this.settings.listSettings();
  }

  @Put('settings/:key')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Create or update a platform setting' })
  upsert(
    @Param() params: SettingParamsDto,
    @Body() dto: UpsertSettingDto,
    @Req() req: AuthedRequest,
  ) {
    return this.settings.upsertSetting(params.key, dto, req.user.sub);
  }

  @Delete('settings/:key')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Delete a platform setting' })
  remove(@Param() params: SettingParamsDto, @Req() req: AuthedRequest) {
    return this.settings.removeSetting(params.key, req.user.sub);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'View audit log with filters' })
  auditLogs(@Query() query: AuditLogsQueryDto) {
    return this.settings.auditLogs(query);
  }
}
