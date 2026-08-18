import { Module } from '@nestjs/common';
import { NotificationController } from './presentation/notification.controller';
import { NotificationService } from './application/notification.service';
import { NotificationsListener } from './infrastructure/notifications.listener';

@Module({
  imports: [],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationsListener],
})
export class NotificationModule {}
