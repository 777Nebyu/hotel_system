import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DiscoverService } from './application/discover.service';
import { DiscoverController } from './presentation/discover.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DiscoverController],
  providers: [DiscoverService],
  exports: [DiscoverService],
})
export class DiscoverModule {}
