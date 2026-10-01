import { Module } from '@nestjs/common';
import { ResourceScopeHelper } from '../../common/guards/resource-scope.helper';
import { AuditService } from '../../common/services/audit.service';
import { CouponModule } from '../coupon/coupon.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationModule } from '../notification/notification.module';
import { BookingController } from './presentation/booking.controller';
import { ManagerBookingController } from './presentation/manager-booking.controller';
import { BookingService } from './application/booking.service';
import { ManagerBookingService } from './application/manager-booking.service';

@Module({
  imports: [CouponModule, InvoiceModule, JobsModule, NotificationModule],
  controllers: [ManagerBookingController, BookingController],
  providers: [
    BookingService,
    ManagerBookingService,
    ResourceScopeHelper,
    AuditService,
  ],
  // AiModule injects BookingService into its booking tools. Without this
  // export Nest resolves the constructor param as unknown and bootstrap fails.
  exports: [BookingService],
})
export class BookingModule {}
