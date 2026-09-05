import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { AdminBookingService } from './application/admin-booking.service';
import { AdminHotelService } from './application/admin-hotel.service';
import { AdminReviewService } from './application/admin-review.service';
import { AdminSettingService } from './application/admin-setting.service';
import { AdminStaffService } from './application/admin-staff.service';
import { AdminSuspensionService } from './application/admin-suspension.service';
import { AdminUsersService } from './application/admin-users.service';
import { AdminBookingController } from './presentation/admin-booking.controller';
import { AdminHotelController } from './presentation/admin-hotel.controller';
import { AdminReviewController } from './presentation/admin-review.controller';
import { AdminSettingController } from './presentation/admin-setting.controller';
import { AdminStaffController } from './presentation/admin-staff.controller';
import { AdminSuspensionController } from './presentation/admin-suspension.controller';
import { AdminUsersController } from './presentation/admin-users.controller';

import { AdminExportService } from './application/admin-export.service';
import { AdminExportController } from './presentation/admin-export.controller';
import { AdminImportService } from './application/admin-import.service';
import { AdminImportController } from './presentation/admin-import.controller';

@Module({
  controllers: [
    AdminUsersController,
    AdminHotelController,
    AdminBookingController,
    AdminReviewController,
    AdminSettingController,
    AdminStaffController,
    AdminSuspensionController,
    AdminExportController,
    AdminImportController,
  ],
  providers: [
    AdminUsersService,
    AdminHotelService,
    AdminBookingService,
    AdminReviewService,
    AdminSettingService,
    AdminStaffService,
    AdminSuspensionService,
    AdminExportService,
    AdminImportService,
    AuditService,
  ],
})
export class AdminModule {}
