import { UnauthorizedException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../prisma/prisma.service';
import { PaymentService } from './payment.service';

describe('PaymentService lifecycle protections', () => {
  const payment = {
    id: 'payment-1',
    bookingId: 'booking-1',
    method: 'CREDIT_CARD',
    amount: { toNumber: () => 100 },
    status: 'PENDING',
    providerRef: null,
    booking: {
      id: 'booking-1',
      userId: 'user-1',
      status: 'CANCELLED',
      hotel: { managerId: null },
    },
  };
  let db: any;
  let emitter: any;
  let registry: any;
  let config: any;
  let service: PaymentService;

  beforeEach(() => {
    db = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...payment,
          status: 'SUCCEEDED',
          providerRef: 'provider-1',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    emitter = { emit: jest.fn() };
    registry = {
      get: jest.fn().mockReturnValue({
        charge: jest.fn().mockResolvedValue({
          approved: true,
          providerRef: 'provider-1',
        }),
      }),
    };
    config = { getOrThrow: jest.fn().mockReturnValue('test-webhook-secret') };
    service = new PaymentService(
      db as PrismaService,
      emitter as EventEmitter2,
      registry,
      config as ConfigService,
    );
  });

  it('rejects callbacks without the configured webhook secret', async () => {
    await expect(
      service.mockCallback('booking-1', {}, 'wrong-secret'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.payment.findUnique).not.toHaveBeenCalled();
  });

  it('emits completion only when the conditional payment update wins', async () => {
    await service.mockCallback('booking-1', { reference: '4242' }, 'test-webhook-secret');
    expect(db.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { in: ['PENDING', 'FAILED'] } }) }),
    );
    expect(emitter.emit).toHaveBeenCalledTimes(1);

    db.payment.findUnique.mockResolvedValue({ ...payment, status: 'SUCCEEDED', providerRef: 'provider-1' });
    const replay = await service.mockCallback('booking-1', { reference: '4242' }, 'test-webhook-secret');
    expect(replay.idempotent).toBe(true);
    expect(emitter.emit).toHaveBeenCalledTimes(1);
  });

  it('refunds only an owner-authorized successful payment and emits once', async () => {
    db.payment.findUnique.mockResolvedValue({ ...payment, status: 'SUCCEEDED' });
    const result = await service.refund('booking-1', { sub: 'user-1', role: 'CUSTOMER' });
    expect(result.status).toBe('REFUNDED');
    expect(result.idempotent).toBe(false);
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'SUCCEEDED' },
      data: { status: 'REFUNDED' },
    });
  });
});
