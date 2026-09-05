import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PURGE_QUEUE } from './jobs.constants';

export const ACCOUNT_PURGE_JOB = 'account-purge';

@Injectable()
export class AccountPurgeScheduler implements OnModuleInit {
  private readonly logger = new Logger(AccountPurgeScheduler.name);

  constructor(@InjectQueue(PURGE_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        'account-purge-daily',
        { every: 24 * 60 * 60 * 1000 },
        { name: ACCOUNT_PURGE_JOB, data: {} },
      );
    } catch (err) {
      this.logger.warn(
        `Could not register account purge scheduler: ${(err as Error).message}`,
      );
    }
  }
}
