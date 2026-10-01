import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TripController } from './presentation/trip.controller';
import { TripService } from './application/trip.service';

@Module({
  imports: [PrismaModule],
  controllers: [TripController],
  providers: [TripService],
  exports: [TripService],
})
export class TripModule {}
