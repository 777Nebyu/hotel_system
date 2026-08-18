import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MAIL_QUEUE } from './jobs.module';
import { EmailService, type MailJob } from '../email/email.service';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly email: EmailService) {
    super();
  }

  async process(job: Job<MailJob>): Promise<void> {
    try {
      await this.email.send(job.data);
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${job.data.to}: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
