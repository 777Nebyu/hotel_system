import { Module } from '@nestjs/common';
import { AdminReportingController } from './presentation/admin-reporting.controller';
import { AdminReportingService } from './application/admin-reporting.service';

@Module({
  controllers: [AdminReportingController],
  providers: [AdminReportingService],
})
export class AdminReportingModule {}
