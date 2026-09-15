import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService } from './feature-flag.service';
import {
  FEATURE_FLAG_KEY_METADATA,
  type FeatureFlagKey,
} from './feature-flags.constants';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.getAllAndOverride<FeatureFlagKey>(
      FEATURE_FLAG_KEY_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!flagKey) return true;

    const isEnabled = await this.flags.isEnabled(flagKey);
    if (!isEnabled) {
      throw new ServiceUnavailableException(
        `Feature "${flagKey}" is temporarily disabled on this platform`,
      );
    }
    return true;
  }
}
