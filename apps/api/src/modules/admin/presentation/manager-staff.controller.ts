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
import { z } from 'zod';
import { Role } from '../../../generated/prisma/client';
import {
  assignStaffSchema,
  hotelStaffQuerySchema,
  staffHotelParamsSchema,
} from '@repo/shared-types';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ResourceScopeHelper } from '../../../common/guards/resource-scope.helper';
import { AdminStaffService } from '../application/admin-staff.service';

const managerHotelParamsSchema = z.object({
  hotelId: z.string().min(1),
});

class ManagerHotelParamsDto extends createZodDto(managerHotelParamsSchema) {}
class AssignStaffDto extends createZodDto(assignStaffSchema) {}
class StaffHotelParamsDto extends createZodDto(staffHotelParamsSchema) {}
class HotelStaffQueryDto extends createZodDto(hotelStaffQuerySchema) {}

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('staff (manager)')
@ApiBearerAuth()
@Roles(Role.MANAGER, Role.ADMIN)
@Controller('manager/hotels/:hotelId/staff')
export class ManagerStaffController {
  constructor(
    private readonly staff: AdminStaffService,
    private readonly scope: ResourceScopeHelper,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List staff assigned to hotel (manager/admin)' })
  async list(
    @Param() params: ManagerHotelParamsDto,
    @Query() query: HotelStaffQueryDto,
    @Req() req: AuthedRequest,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );
    return this.staff.listHotelStaff(params.hotelId, query);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Assign a staff member to hotel (manager/admin)' })
  async assign(
    @Param() params: ManagerHotelParamsDto,
    @Body() dto: AssignStaffDto,
    @Req() req: AuthedRequest,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );
    return this.staff.assignStaff(params.hotelId, dto, req.user.sub);
  }

  @Delete(':staffId')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Remove a staff member from hotel (manager/admin)' })
  async remove(
    @Param() params: StaffHotelParamsDto,
    @Req() req: AuthedRequest,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );
    return this.staff.removeStaff(params.hotelId, params.staffId, req.user.sub);
  }
}
