import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationController } from './presentation/notification.controller';
import { NotificationService } from './application/notification.service';
import { NotificationsListener } from './infrastructure/notifications.listener';
import { JobsModule } from '../jobs/jobs.module';
import {
  ExpoPushProvider,
  MockPushProvider,
  PUSH_NOTIFICATION_PROVIDER,
} from './infrastructure/push';

@Module({
  imports: [JobsModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationsListener,
    {
      provide: PUSH_NOTIFICATION_PROVIDER,
      useFactory: (config: ConfigService) => {
        if (
          process.env.NODE_ENV === 'test' ||
          !config.get<string>('EXPO_ACCESS_TOKEN')
        ) {
          return new MockPushProvider();
        }
        return new ExpoPushProvider(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [NotificationService, PUSH_NOTIFICATION_PROVIDER],
})
export class NotificationModule {}
