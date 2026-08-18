import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MAIL_QUEUE } from './jobs.constants';
import { EmailService, type MailJob } from '../email/email.service';

@Injectable()
export class MailProducer {
  private readonly logger = new Logger(MailProducer.name);

  constructor(
    @InjectQueue(MAIL_QUEUE) private readonly queue: Queue,
    private readonly email: EmailService,
  ) {}

  async enqueue(job: MailJob): Promise<void> {
    try {
      await this.queue.add('send', job, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      });
    } catch (err) {
      this.logger.warn(
        `Mail queue unavailable (${(err as Error).message}); sending synchronously`,
      );
      await this.email.send(job);
    }
  }

  enqueueVerification(to: string, token: string): Promise<void> {
    return this.enqueue(this.email.verificationMail(to, token));
  }

  enqueuePasswordReset(to: string, token: string): Promise<void> {
    return this.enqueue(this.email.passwordResetMail(to, token));
  }
}
