import { Module } from '@nestjs/common';
import { ResourceScopeHelper } from '../../common/guards/resource-scope.helper';
import { BookingController } from './presentation/booking.controller';
import { ManagerBookingController } from './presentation/manager-booking.controller';
import { BookingService } from './application/booking.service';
import { ManagerBookingService } from './application/manager-booking.service';

@Module({
  controllers: [BookingController, ManagerBookingController],
  providers: [BookingService, ManagerBookingService, ResourceScopeHelper],
})
export class BookingModule {}
