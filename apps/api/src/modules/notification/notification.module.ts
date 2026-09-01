import { Module } from '@nestjs/common';
import { NotificationController } from './presentation/notification.controller';
import { NotificationService } from './application/notification.service';
import { NotificationsListener } from './infrastructure/notifications.listener';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [JobsModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationsListener],
  exports: [NotificationService],
})
export class NotificationModule {}
