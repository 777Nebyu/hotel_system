import { Module } from '@nestjs/common';
import { AdminReportingController } from './presentation/admin-reporting.controller';
import { ManagerReportingController } from './presentation/manager-reporting.controller';
import { AdminReportingService } from './application/admin-reporting.service';
import { ResourceScopeHelper } from '../../common/guards/resource-scope.helper';

@Module({
  controllers: [AdminReportingController, ManagerReportingController],
  providers: [AdminReportingService, ResourceScopeHelper],
  exports: [AdminReportingService],
})
export class AdminReportingModule {}
