import { Module } from '@nestjs/common';
import { DisputeService } from './application/dispute.service';
import { DisputeController } from './presentation/dispute.controller';

@Module({
  controllers: [DisputeController],
  providers: [DisputeService],
  exports: [DisputeService],
})
export class DisputeModule {}
