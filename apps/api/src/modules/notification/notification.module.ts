import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { NotificationController } from './presentation/notification.controller';
import { NotificationService } from './application/notification.service';
import { NotificationsListener } from './infrastructure/notifications.listener';

@Module({
  imports: [EmailModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationsListener],
})
export class NotificationModule {}
