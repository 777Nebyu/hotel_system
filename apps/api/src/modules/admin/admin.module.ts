import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { AdminBookingService } from './application/admin-booking.service';
import { AdminHotelService } from './application/admin-hotel.service';
import { AdminReviewService } from './application/admin-review.service';
import { AdminSettingService } from './application/admin-setting.service';
import { AdminUsersService } from './application/admin-users.service';
import { AdminBookingController } from './presentation/admin-booking.controller';
import { AdminHotelController } from './presentation/admin-hotel.controller';
import { AdminReviewController } from './presentation/admin-review.controller';
import { AdminSettingController } from './presentation/admin-setting.controller';
import { AdminUsersController } from './presentation/admin-users.controller';

@Module({
  controllers: [
    AdminUsersController,
    AdminHotelController,
    AdminBookingController,
    AdminReviewController,
    AdminSettingController,
  ],
  providers: [
    AdminUsersService,
    AdminHotelService,
    AdminBookingService,
    AdminReviewService,
    AdminSettingService,
    AuditService,
  ],
})
export class AdminModule {}
