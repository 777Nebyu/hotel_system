import { Module } from '@nestjs/common';
import { ResourceScopeHelper } from '../../common/guards/resource-scope.helper';
import { CouponModule } from '../coupon/coupon.module';
import { BookingController } from './presentation/booking.controller';
import { ManagerBookingController } from './presentation/manager-booking.controller';
import { BookingService } from './application/booking.service';
import { ManagerBookingService } from './application/manager-booking.service';

@Module({
  imports: [CouponModule],
  controllers: [BookingController, ManagerBookingController],
  providers: [BookingService, ManagerBookingService, ResourceScopeHelper],
})
export class BookingModule {}
