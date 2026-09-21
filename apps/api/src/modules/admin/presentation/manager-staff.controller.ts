import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
  hotelStaffQuerySchema,
  staffHotelParamsSchema,
} from '@repo/shared-types';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ResourceScopeHelper } from '../../../common/guards/resource-scope.helper';
import { AdminStaffService } from '../application/admin-staff.service';

const managerHotelParamsSchema = z.object({
  hotelId: z.string().min(1),
});

const addStaffSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(100).optional(),
  phone: z.string().max(30).optional(),
  role: z.string().min(1).max(50).optional(),
  staffId: z.string().optional(),
});

const updateStaffStatusSchema = z.object({
  isActive: z.boolean(),
});

const updateStaffRoleSchema = z.object({
  role: z.string().min(1).max(50),
});

class ManagerHotelParamsDto extends createZodDto(managerHotelParamsSchema) {}
class AddStaffDto extends createZodDto(addStaffSchema) {}
class StaffHotelParamsDto extends createZodDto(staffHotelParamsSchema) {}
class HotelStaffQueryDto extends createZodDto(hotelStaffQuerySchema) {}
class UpdateStaffStatusDto extends createZodDto(updateStaffStatusSchema) {}
class UpdateStaffRoleDto extends createZodDto(updateStaffRoleSchema) {}

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
  @ApiOperation({ summary: 'Create or assign a staff member to hotel (manager/admin)' })
  async add(
    @Param() params: ManagerHotelParamsDto,
    @Body() dto: AddStaffDto,
    @Req() req: AuthedRequest,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );

    if (dto.password && dto.fullName && dto.email) {
      return this.staff.createAndAssignStaff(
        params.hotelId,
        {
          fullName: dto.fullName,
          email: dto.email,
          password: dto.password,
          phone: dto.phone,
          role: dto.role,
        },
        req.user.sub,
      );
    }

    return this.staff.assignStaff(
      params.hotelId,
      { staffId: dto.staffId, email: dto.email, role: dto.role },
      req.user.sub,
    );
  }

  assign(
    params: ManagerHotelParamsDto,
    dto: AddStaffDto,
    req: AuthedRequest,
  ) {
    return this.add(params, dto, req);
  }

  @Patch(':staffId/status')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Update staff active status (manager/admin)' })
  async updateStatus(
    @Param() params: StaffHotelParamsDto,
    @Body() dto: UpdateStaffStatusDto,
    @Req() req: AuthedRequest,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );
    return this.staff.updateStaffStatus(
      params.hotelId,
      params.staffId,
      dto.isActive,
      req.user.sub,
    );
  }

  @Patch(':staffId/role')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Update staff role title (manager/admin)' })
  async updateRole(
    @Param() params: StaffHotelParamsDto,
    @Body() dto: UpdateStaffRoleDto,
    @Req() req: AuthedRequest,
  ) {
    await this.scope.assertManagerOwnsHotel(
      req.user.sub,
      req.user.role,
      params.hotelId,
    );
    return this.staff.updateStaffRole(
      params.hotelId,
      params.staffId,
      dto.role,
      req.user.sub,
    );
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
