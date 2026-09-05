import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DisputeService } from './dispute.service';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { FraudService } from '../../fraud/application/fraud.service';

describe('DisputeService', () => {
  let service: DisputeService;
  let db: {
    booking: { findUnique: jest.Mock };
    dispute: {
      create: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let fraud: { checkDisputeVelocity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    db = {
      booking: { findUnique: jest.fn() },
      dispute: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    fraud = {
      checkDisputeVelocity: jest.fn().mockResolvedValue(false),
    };

    service = new DisputeService(
      db as unknown as PrismaService,
      fraud as unknown as FraudService,
    );
  });

  it('throws NotFoundException if booking not found', async () => {
    db.booking.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ bookingId: 'b-1', reason: 'Bad service' }, 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException if booking belongs to someone else', async () => {
    db.booking.findUnique.mockResolvedValue({ id: 'b-1', userId: 'user-2' });

    await expect(
      service.create({ bookingId: 'b-1', reason: 'Bad service' }, 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates dispute and triggers fraud check', async () => {
    db.booking.findUnique.mockResolvedValue({ id: 'b-1', userId: 'user-1' });
    db.dispute.create.mockResolvedValue({
      id: 'd-1',
      bookingId: 'b-1',
      openedById: 'user-1',
      reason: 'Bad service',
    });

    const result = await service.create(
      { bookingId: 'b-1', reason: 'Bad service' },
      'user-1',
    );

    expect(result.id).toBe('d-1');
    expect(db.dispute.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'b-1',
          openedById: 'user-1',
          reason: 'Bad service',
        }),
      }),
    );
    expect(fraud.checkDisputeVelocity).toHaveBeenCalledWith('user-1');
  });
});
