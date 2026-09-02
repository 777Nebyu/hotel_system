import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EmailModule } from '../email/email.module';
import { MailProducer } from './mail.producer';
import { MailProcessor } from './mail.processor';
import { CheckInReminderScheduler } from './checkin-reminder.scheduler';
import { CheckInReminderProcessor } from './checkin-reminder.processor';
import { BookingExpirationScheduler } from './booking-expiration.scheduler';
import { BookingExpirationProcessor } from './booking-expiration.processor';
import { NoShowScheduler } from './noshow.scheduler';
import { NoShowProcessor } from './noshow.processor';
import { AuditService } from '../../common/services/audit.service';
import {
  EXPIRATION_QUEUE,
  MAIL_QUEUE,
  NOSHOW_QUEUE,
  REMINDER_QUEUE,
} from './jobs.constants';

export {
  EXPIRATION_QUEUE,
  MAIL_QUEUE,
  NOSHOW_QUEUE,
  REMINDER_QUEUE,
} from './jobs.constants';

@Global()
@Module({
  imports: [
    EmailModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('redis.url');
        const isTls = url.startsWith('rediss://') || url.includes('upstash.io');
        return {
          connection: {
            url,
            tls: isTls ? { rejectUnauthorized: false } : undefined,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: MAIL_QUEUE },
      { name: REMINDER_QUEUE },
      { name: EXPIRATION_QUEUE },
      { name: NOSHOW_QUEUE },
    ),
  ],
  providers: [
    MailProducer,
    MailProcessor,
    CheckInReminderScheduler,
    CheckInReminderProcessor,
    BookingExpirationScheduler,
    BookingExpirationProcessor,
    NoShowScheduler,
    NoShowProcessor,
    AuditService,
  ],
  exports: [MailProducer, BullModule],
})
export class JobsModule {}
