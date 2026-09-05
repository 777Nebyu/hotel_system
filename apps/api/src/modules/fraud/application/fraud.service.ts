import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';

@Injectable()
export class FraudService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Evaluates failed payment attempts for the user within the last 15 minutes.
   * If failed attempts >= 3, automatically flags the account.
   */
  async checkPaymentFailureVelocity(userId: string): Promise<boolean> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const failedAttemptsCount = await this.db.paymentAttempt.count({
      where: {
        outcome: 'FAILED',
        attemptedAt: { gte: fifteenMinutesAgo },
        payment: {
          booking: {
            userId,
          },
        },
      },
    });

    if (failedAttemptsCount >= 3) {
      const reason = 'Exceeded payment failure threshold (>=3 failed attempts in 15m)';
      await this.db.user.update({
        where: { id: userId },
        data: {
          isFlagged: true,
          flagReason: reason,
          flaggedAt: new Date(),
        },
      });

      await this.audit.record(
        'system',
        'USER_FLAGGED_FOR_FRAUD',
        'User',
        userId,
        {
          trigger: 'PAYMENT_FAILURE_VELOCITY',
          failedAttemptsCount,
          timeWindowMinutes: 15,
        },
      );

      return true;
    }

    return false;
  }

  /**
   * Evaluates disputes opened by the user within the last 7 days.
   * If disputes >= 3, automatically flags the account.
   */
  async checkDisputeVelocity(userId: string): Promise<boolean> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const disputeCount = await this.db.dispute.count({
      where: {
        openedById: userId,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    if (disputeCount >= 3) {
      const reason = 'Excessive dispute volume (>=3 disputes in 7d)';
      await this.db.user.update({
        where: { id: userId },
        data: {
          isFlagged: true,
          flagReason: reason,
          flaggedAt: new Date(),
        },
      });

      await this.audit.record(
        'system',
        'USER_FLAGGED_FOR_FRAUD',
        'User',
        userId,
        {
          trigger: 'DISPUTE_VELOCITY',
          disputeCount,
          timeWindowDays: 7,
        },
      );

      return true;
    }

    return false;
  }

  /**
   * Manually flags a user account.
   */
  async flagUser(userId: string, adminId: string, reason: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        isFlagged: true,
        flagReason: reason,
        flaggedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isFlagged: true,
        flagReason: true,
        flaggedAt: true,
      },
    });

    await this.audit.record(
      adminId,
      'USER_FLAGGED',
      'User',
      userId,
      { reason },
    );

    return updated;
  }

  /**
   * Removes flag from a user account.
   */
  async unflagUser(userId: string, adminId: string, reason?: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        isFlagged: false,
        flagReason: null,
        flaggedAt: null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isFlagged: true,
        flagReason: true,
        flaggedAt: true,
      },
    });

    await this.audit.record(
      adminId,
      'USER_UNFLAGGED',
      'User',
      userId,
      { reason: reason || 'Manual unflag by admin' },
    );

    return updated;
  }

  /**
   * Lists all flagged users with summary stats.
   */
  async listFlaggedUsers() {
    return this.db.user.findMany({
      where: { isFlagged: true },
      orderBy: { flaggedAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isFlagged: true,
        flagReason: true,
        flaggedAt: true,
        createdAt: true,
        _count: {
          select: {
            disputesOpened: true,
            bookings: true,
          },
        },
      },
    });
  }
}
