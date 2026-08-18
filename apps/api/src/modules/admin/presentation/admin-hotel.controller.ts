import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
