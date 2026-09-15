import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import { Role } from '../../../generated/prisma/client';
import {
  decideSuspensionSchema,
  requestSuspensionSchema,
  suspensionIdParamsSchema,
} from '@repo/shared-types';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminSuspensionService } from '../application/admin-suspension.service';

class RequestSuspensionDto extends createZodDto(requestSuspensionSchema) {}
class DecideSuspensionDto extends createZodDto(decideSuspensionSchema) {}
class SuspensionIdParamsDto extends createZodDto(suspensionIdParamsSchema) {}

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/suspensions')
export class AdminSuspensionController {
  constructor(private readonly service: AdminSuspensionService) {}

  @Get('pending')
  @ApiOperation({ summary: 'List pending suspension requests (four-eyes queue)' })
  listPending() {
    return this.service.listPending();
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Request an emergency suspension (first admin)' })
  request(@Body() dto: RequestSuspensionDto, @Req() req: AuthedRequest) {
    return this.service.request(dto, req.user.sub);
  }

  @Post(':id/decide')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Approve or reject a suspension request (second admin)' })
  decide(
    @Param() params: SuspensionIdParamsDto,
    @Body() dto: DecideSuspensionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.decide(params.id, dto, req.user.sub);
  }

  @Delete(':id')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Cancel own pending suspension request' })
  cancel(@Param() params: SuspensionIdParamsDto, @Req() req: AuthedRequest) {
    return this.service.cancel(params.id, req.user.sub);
  }
}
