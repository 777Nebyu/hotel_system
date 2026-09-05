import { Module } from '@nestjs/common';
import { FraudService } from './application/fraud.service';
import { AuditService } from '../../common/services/audit.service';

@Module({
  providers: [FraudService, AuditService],
  exports: [FraudService],
})
export class FraudModule {}
