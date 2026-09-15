import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EXPIRATION_QUEUE } from './jobs.constants';

export const BOOKING_EXPIRATION_JOB = 'booking-expiration';

@Injectable()
export class BookingExpirationScheduler implements OnModuleInit {
  private readonly logger = new Logger(BookingExpirationScheduler.name);

  constructor(@InjectQueue(EXPIRATION_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        'booking-expiration-every-5m',
        { every: 5 * 60 * 1000 },
        { name: BOOKING_EXPIRATION_JOB, data: {} },
      );
    } catch (err) {
      this.logger.warn(
        `Could not register booking expiration scheduler: ${(err as Error).message}`,
      );
    }
  }
}
