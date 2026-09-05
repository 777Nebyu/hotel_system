import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/services/audit.service';
import {
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlagKey,
} from './feature-flags.constants';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  async isEnabled(key: FeatureFlagKey): Promise<boolean> {
    const cacheKey = `feature_flag:${key}`;
    const cached = await this.cache.get<boolean>(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    const setting = await this.db.platformSetting.findUnique({
      where: { key: `ff_${key}` },
    });

    const enabled =
      setting?.value !== undefined && typeof setting.value === 'boolean'
        ? setting.value
        : DEFAULT_FEATURE_FLAGS[key] ?? true;

    await this.cache.set(cacheKey, enabled, 60);
    return enabled;
  }

  async listFlags(): Promise<Record<string, boolean>> {
    const keys = Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlagKey[];
    const result: Record<string, boolean> = {};
    for (const key of keys) {
      result[key] = await this.isEnabled(key);
    }
    return result;
  }

  async setFlag(
    key: FeatureFlagKey,
    enabled: boolean,
    actorId: string,
    reason?: string,
  ): Promise<boolean> {
    await this.db.platformSetting.upsert({
      where: { key: `ff_${key}` },
      create: { key: `ff_${key}`, value: enabled },
      update: { value: enabled },
    });

    await this.cache.set(`feature_flag:${key}`, enabled, 60);

    await this.audit.record(actorId, 'FEATURE_FLAG_UPDATED', 'FeatureFlag', key, {
      enabled,
      reason,
    });

    return enabled;
  }
}
