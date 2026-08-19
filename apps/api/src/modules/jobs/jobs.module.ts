import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EmailModule } from '../email/email.module';
import { MailProducer } from './mail.producer';
import { MailProcessor } from './mail.processor';
import { CheckInReminderScheduler } from './checkin-reminder.scheduler';
import { CheckInReminderProcessor } from './checkin-reminder.processor';
import { MAIL_QUEUE, REMINDER_QUEUE } from './jobs.constants';

export { MAIL_QUEUE, REMINDER_QUEUE } from './jobs.constants';

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
    BullModule.registerQueue({ name: MAIL_QUEUE }, { name: REMINDER_QUEUE }),
  ],
  providers: [
    MailProducer,
    MailProcessor,
    CheckInReminderScheduler,
    CheckInReminderProcessor,
  ],
  exports: [MailProducer, BullModule],
})
export class JobsModule {}
