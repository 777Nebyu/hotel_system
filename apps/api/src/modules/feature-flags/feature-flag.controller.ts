import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../generated/prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { FeatureFlagService } from './feature-flag.service';
import {
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlagKey,
} from './feature-flags.constants';

interface AuthedRequest {
  user: { sub: string; role: string };
}

interface UpdateFlagBody {
  enabled: boolean;
  reason?: string;
}

@ApiTags('admin (feature-flags)')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/feature-flags')
export class FeatureFlagController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Get()
  @ApiOperation({ summary: 'List all feature flags and their current status' })
  list() {
    return this.flags.listFlags();
  }

  @Patch(':key')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Enable or disable a feature flag' })
  async updateFlag(
    @Param('key') key: string,
    @Body() body: UpdateFlagBody,
    @Req() req: AuthedRequest,
  ) {
    if (!(key in DEFAULT_FEATURE_FLAGS)) {
      throw new BadRequestException(
        `Invalid feature flag key: "${key}". Must be one of: ${Object.keys(DEFAULT_FEATURE_FLAGS).join(', ')}`,
      );
    }
    if (typeof body.enabled !== 'boolean') {
      throw new BadRequestException('"enabled" must be a boolean');
    }

    const enabled = await this.flags.setFlag(
      key as FeatureFlagKey,
      body.enabled,
      req.user.sub,
      body.reason,
    );

    return { key, enabled };
  }
}
