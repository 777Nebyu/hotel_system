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
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminUsersService } from '../application/admin-users.service';
import {
  AdminUsersQueryDto,
  SetUserActiveDto,
  UpdateUserRoleDto,
  UserIdParamsDto,
} from './dto/admin.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with filters and pagination' })
  list(@Query() query: AdminUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get a single user profile for admin review' })
  get(@Param() params: UserIdParamsDto) {
    return this.users.get(params.userId);
  }

  @Patch(':userId/role')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Change a user role (promote/demote)' })
  updateRole(
    @Param() params: UserIdParamsDto,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: AuthedRequest,
  ) {
    return this.users.updateRole(params.userId, dto, req.user.sub);
  }

  @Patch(':userId/active')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  setActive(
    @Param() params: UserIdParamsDto,
    @Body() dto: SetUserActiveDto,
    @Req() req: AuthedRequest,
  ) {
    return this.users.setActive(params.userId, dto, req.user.sub);
  }
}
