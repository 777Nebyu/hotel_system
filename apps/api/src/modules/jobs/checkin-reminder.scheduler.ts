import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { REMINDER_QUEUE } from './jobs.constants';

export const CHECKIN_REMINDER_JOB = 'checkin-reminder';

@Injectable()
export class CheckInReminderScheduler implements OnModuleInit {
  private readonly logger = new Logger(CheckInReminderScheduler.name);

  constructor(@InjectQueue(REMINDER_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        'checkin-reminder-every-6h',
        { every: 6 * 60 * 60 * 1000 },
        { name: CHECKIN_REMINDER_JOB, data: {} },
      );
    } catch (err) {
      this.logger.warn(
        `Could not register check-in reminder scheduler: ${(err as Error).message}`,
      );
    }
  }
}
