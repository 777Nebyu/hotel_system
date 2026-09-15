import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PURGE_QUEUE } from './jobs.constants';
import { ACCOUNT_PURGE_JOB } from './account-purge.scheduler';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';

@Processor(PURGE_QUEUE)
export class AccountPurgeProcessor extends WorkerHost {
  private readonly logger = new Logger(AccountPurgeProcessor.name);

  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== ACCOUNT_PURGE_JOB) return;

    const expiredUsers = await this.db.user.findMany({
      where: {
        status: 'DEACTIVATED',
        deletionScheduledFor: { lt: new Date() },
      },
      select: { id: true, email: true },
    });

    if (!expiredUsers.length) return;

    this.logger.log(`Found ${expiredUsers.length} deactivated accounts pending permanent purge`);

    for (const user of expiredUsers) {
      await this.db.user.update({
        where: { id: user.id },
        data: {
          status: 'DELETED',
          isActive: false,
          fullName: 'Deleted User',
          email: `deleted_${user.id}@anonymized.local`,
          phone: null,
          profilePhotoUrl: null,
          deletedAt: new Date(),
          deletionScheduledFor: null,
          refreshTokenHash: null,
          refreshTokenFamily: null,
        },
      });

      await this.db.notificationPreference.deleteMany({
        where: { userId: user.id },
      });

      await this.audit.record(
        'system',
        'USER_PURGED',
        'User',
        user.id,
        { originalEmail: user.email },
      );
    }
  }
}
