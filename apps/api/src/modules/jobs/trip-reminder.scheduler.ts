import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { REMINDER_QUEUE } from './jobs.constants';

export const TRIP_REMINDER_JOB = 'trip-reminder';

@Injectable()
export class TripReminderScheduler implements OnModuleInit {
  private readonly logger = new Logger(TripReminderScheduler.name);

  constructor(@InjectQueue(REMINDER_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        'trip-reminder-every-15m',
        { every: 15 * 60 * 1000 },
        { name: TRIP_REMINDER_JOB, data: {} },
      );
    } catch (err) {
      this.logger.warn(
        `Could not register trip reminder scheduler: ${(err as Error).message}`,
      );
    }
  }
}
