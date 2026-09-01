import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../../generated/prisma/client';
import { hotelIdParamsSchema } from '@repo/shared-types';
import { createZodDto } from 'nestjs-zod';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminHotelService } from '../application/admin-hotel.service';
import {
  AdminHotelsQueryDto,
  ReassignManagerDto,
  RejectHotelDto,
  UpdateHotelStatusDto,
} from './dto/admin.dto';

class HotelIdParamsDto extends createZodDto(hotelIdParamsSchema) {}

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/hotels')
export class AdminHotelController {
  constructor(private readonly hotels: AdminHotelService) {}

  @Get()
  @ApiOperation({ summary: 'List all hotels with status filters' })
  list(@Query() query: AdminHotelsQueryDto) {
    return this.hotels.list(query);
  }

  @Post(':id/approve')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Approve a hotel listing' })
  approve(@Param() params: HotelIdParamsDto, @Req() req: AuthedRequest) {
    return this.hotels.approve(params.id, req.user.sub);
  }

  @Post(':id/reject')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Reject a hotel listing with reason' })
  reject(
    @Param() params: HotelIdParamsDto,
    @Body() dto: RejectHotelDto,
    @Req() req: AuthedRequest,
  ) {
    return this.hotels.reject(params.id, dto.reason, req.user.sub);
  }

  @Patch(':id/status')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Approve / reject / suspend a hotel listing' })
  updateStatus(
    @Param() params: HotelIdParamsDto,
    @Body() dto: UpdateHotelStatusDto,
    @Req() req: AuthedRequest,
  ) {
    return this.hotels.updateStatus(params.id, dto, req.user.sub);
  }

  @Patch(':id/manager')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Assign or remove the hotel manager' })
  reassignManager(
    @Param() params: HotelIdParamsDto,
    @Body() dto: ReassignManagerDto,
    @Req() req: AuthedRequest,
  ) {
    return this.hotels.reassignManager(params.id, dto, req.user.sub);
  }
}
