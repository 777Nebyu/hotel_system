import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOSHOW_QUEUE } from './jobs.constants';

export const NOSHOW_DETECTION_JOB = 'noshow-detection';

@Injectable()
export class NoShowScheduler implements OnModuleInit {
  private readonly logger = new Logger(NoShowScheduler.name);

  constructor(@InjectQueue(NOSHOW_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        'noshow-detection-hourly',
        { every: 60 * 60 * 1000 },
        { name: NOSHOW_DETECTION_JOB, data: {} },
      );
    } catch (err) {
      this.logger.warn(
        `Could not register no-show scheduler: ${(err as Error).message}`,
      );
    }
  }
}
