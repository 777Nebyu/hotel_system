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
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminUsersService } from '../application/admin-users.service';
import {
  AdminUsersQueryDto,
  FlagUserDto,
  SetUserActiveDto,
  UnflagUserDto,
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

  @Get('flagged')
  @ApiOperation({ summary: 'List all flagged user accounts' })
  listFlagged() {
    return this.users.listFlagged();
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

  @Post(':userId/flag')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Manually flag a user account for review' })
  flagUser(
    @Param() params: UserIdParamsDto,
    @Body() dto: FlagUserDto,
    @Req() req: AuthedRequest,
  ) {
    return this.users.flagUser(params.userId, dto.reason, req.user.sub);
  }

  @Post(':userId/unflag')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Remove risk flag from user account' })
  unflagUser(
    @Param() params: UserIdParamsDto,
    @Body() dto: UnflagUserDto,
    @Req() req: AuthedRequest,
  ) {
    return this.users.unflagUser(params.userId, dto.reason, req.user.sub);
  }
}
