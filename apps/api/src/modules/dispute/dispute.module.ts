import { Module } from '@nestjs/common';
import { DisputeService } from './application/dispute.service';
import { DisputeController } from './presentation/dispute.controller';
import { FraudModule } from '../fraud/fraud.module';

@Module({
  imports: [FraudModule],
  controllers: [DisputeController],
  providers: [DisputeService],
  exports: [DisputeService],
})
export class DisputeModule {}
