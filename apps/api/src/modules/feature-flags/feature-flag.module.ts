import { Global, Module } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureFlagGuard } from './feature-flag.guard';
import { FeatureFlagController } from './feature-flag.controller';
import { AuditService } from '../../common/services/audit.service';

@Global()
@Module({
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService, FeatureFlagGuard, AuditService],
  exports: [FeatureFlagService, FeatureFlagGuard],
})
export class FeatureFlagModule {}
