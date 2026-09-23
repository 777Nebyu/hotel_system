import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import { Role } from '../../../generated/prisma/client';
import {
  assignStaffSchema,
  hotelIdParamsSchema,
  hotelStaffQuerySchema,
  staffHotelParamsSchema,
} from '@repo/shared-types';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminStaffService } from '../application/admin-staff.service';

class HotelIdParamsDto extends createZodDto(hotelIdParamsSchema) {}
class AssignStaffDto extends createZodDto(assignStaffSchema) {}
class StaffHotelParamsDto extends createZodDto(staffHotelParamsSchema) {}
class HotelStaffQueryDto extends createZodDto(hotelStaffQuerySchema) {}

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminStaffController {
  constructor(private readonly staff: AdminStaffService) {}

  @Get('staff-assignments')
  @ApiOperation({ summary: 'List all staff–hotel assignments across all hotels' })
  listAll() {
    return this.staff.listAllAssignments();
  }

  @Get('hotels/:id/staff')
  @ApiOperation({ summary: 'List staff assigned to a hotel' })
  list(@Param() params: HotelIdParamsDto, @Query() query: HotelStaffQueryDto) {
    return this.staff.listHotelStaff(params.id, query);
  }

  @Post('hotels/:id/staff')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Assign a staff member to a hotel' })
  assign(
    @Param() params: HotelIdParamsDto,
    @Body() dto: AssignStaffDto,
    @Req() req: AuthedRequest,
  ) {
    return this.staff.assignStaff(params.id, dto, req.user.sub);
  }

  @Delete('hotels/:id/staff/:staffId')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Remove a staff member from a hotel' })
  remove(
    @Param('id') hotelId: string,
    @Param('staffId') staffId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.staff.removeStaff(hotelId, staffId, req.user.sub);
  }
}
