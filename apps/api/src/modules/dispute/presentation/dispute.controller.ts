import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { DisputeService } from '../application/dispute.service';
import {
  CreateDisputeDto,
  DisputeIdParamsDto,
  DisputeQueryDto,
  ResolveDisputeDto,
} from './dto/dispute.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('disputes')
@ApiBearerAuth()
@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputes: DisputeService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Open a dispute for a booking' })
  create(@Body() dto: CreateDisputeDto, @Req() req: AuthedRequest) {
    return this.disputes.create(dto, req.user.sub);
  }

  @Get('mine')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'List your disputes' })
  listMine(@Query() query: DisputeQueryDto, @Req() req: AuthedRequest) {
    return this.disputes.listForUser(req.user.sub, query);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'List all disputes (admin/manager/staff)' })
  adminList(@Query() query: DisputeQueryDto) {
    return this.disputes.adminList(query);
  }

  @Post(':id/review')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Roles(Role.ADMIN, Role.MANAGER, Role.STAFF)
  @ApiOperation({ summary: 'Mark dispute as under review' })
  markUnderReview(@Param() params: DisputeIdParamsDto) {
    return this.disputes.markUnderReview(params.id);
  }

  @Post(':id/resolve')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Resolve a dispute with a resolution note' })
  resolve(@Param() params: DisputeIdParamsDto, @Body() dto: ResolveDisputeDto) {
    return this.disputes.resolve(params.id, dto);
  }

  @Post(':id/close')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Close a resolved dispute' })
  close(@Param() params: DisputeIdParamsDto) {
    return this.disputes.close(params.id);
  }
}
