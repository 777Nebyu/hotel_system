import { NotFoundException } from '@nestjs/common';
import { FraudService } from './fraud.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditService } from '../../../common/services/audit.service';

describe('FraudService', () => {
  let service: FraudService;
  let db: {
    paymentAttempt: { count: jest.Mock };
    dispute: { count: jest.Mock };
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let audit: { record: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    db = {
      paymentAttempt: {
        count: jest.fn(),
      },
      dispute: {
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new FraudService(
      db as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('checkPaymentFailureVelocity', () => {
    it('does not flag user if failed payment attempts are below 3', async () => {
      db.paymentAttempt.count.mockResolvedValue(2);

      const flagged = await service.checkPaymentFailureVelocity('user-1');

      expect(flagged).toBe(false);
      expect(db.user.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('auto-flags user if failed payment attempts are >= 3 in 15m', async () => {
      db.paymentAttempt.count.mockResolvedValue(3);
      db.user.update.mockResolvedValue({ id: 'user-1', isFlagged: true });

      const flagged = await service.checkPaymentFailureVelocity('user-1');

      expect(flagged).toBe(true);
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            isFlagged: true,
            flagReason: expect.stringContaining('payment failure threshold'),
            flaggedAt: expect.any(Date),
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        'system',
        'USER_FLAGGED_FOR_FRAUD',
        'User',
        'user-1',
        expect.objectContaining({
          trigger: 'PAYMENT_FAILURE_VELOCITY',
          failedAttemptsCount: 3,
        }),
      );
    });
  });

  describe('checkDisputeVelocity', () => {
    it('does not flag user if disputes in 7d are below 3', async () => {
      db.dispute.count.mockResolvedValue(1);

      const flagged = await service.checkDisputeVelocity('user-1');

      expect(flagged).toBe(false);
      expect(db.user.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('auto-flags user if disputes are >= 3 in 7d', async () => {
      db.dispute.count.mockResolvedValue(3);
      db.user.update.mockResolvedValue({ id: 'user-1', isFlagged: true });

      const flagged = await service.checkDisputeVelocity('user-1');

      expect(flagged).toBe(true);
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            isFlagged: true,
            flagReason: expect.stringContaining('Excessive dispute volume'),
            flaggedAt: expect.any(Date),
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        'system',
        'USER_FLAGGED_FOR_FRAUD',
        'User',
        'user-1',
        expect.objectContaining({
          trigger: 'DISPUTE_VELOCITY',
          disputeCount: 3,
        }),
      );
    });
  });

  describe('flagUser and unflagUser', () => {
    it('manually flags a user with admin reason', async () => {
      db.user.findUnique.mockResolvedValue({ id: 'user-1' });
      db.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'u1@test.com',
        fullName: 'User One',
        isFlagged: true,
        flagReason: 'Suspicious card usage',
        flaggedAt: new Date(),
      });

      const res = await service.flagUser('user-1', 'admin-1', 'Suspicious card usage');

      expect(res.isFlagged).toBe(true);
      expect(audit.record).toHaveBeenCalledWith(
        'admin-1',
        'USER_FLAGGED',
        'User',
        'user-1',
        { reason: 'Suspicious card usage' },
      );
    });

    it('throws NotFoundException if user does not exist when flagging', async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        service.flagUser('non-existent', 'admin-1', 'Reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('unflags a flagged user', async () => {
      db.user.findUnique.mockResolvedValue({ id: 'user-1' });
      db.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'u1@test.com',
        fullName: 'User One',
        isFlagged: false,
        flagReason: null,
        flaggedAt: null,
      });

      const res = await service.unflagUser('user-1', 'admin-1', 'Verified legitimate user');

      expect(res.isFlagged).toBe(false);
      expect(audit.record).toHaveBeenCalledWith(
        'admin-1',
        'USER_UNFLAGGED',
        'User',
        'user-1',
        { reason: 'Verified legitimate user' },
      );
    });
  });

  describe('listFlaggedUsers', () => {
    it('returns list of flagged users', async () => {
      db.user.findMany.mockResolvedValue([
        {
          id: 'user-flagged-1',
          email: 'flagged@example.com',
          isFlagged: true,
          flagReason: 'Velocity',
        },
      ]);

      const list = await service.listFlaggedUsers();

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('user-flagged-1');
      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isFlagged: true },
        }),
      );
    });
  });
});
