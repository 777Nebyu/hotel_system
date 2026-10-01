import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../prisma/prisma.service';
import { PaymentService } from './payment.service';

describe('PaymentService lifecycle protections', () => {
  const futureCheckIn = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const payment = {
    id: 'payment-1',
    bookingId: 'booking-1',
    method: 'CREDIT_CARD',
    amount: { toNumber: () => 100 },
    status: 'PENDING',
    providerRef: null,
    refundAmount: null,
    booking: {
      id: 'booking-1',
      userId: 'user-1',
      status: 'PENDING',
      checkIn: futureCheckIn,
      hotel: { managerId: null },
    },
  };
  let db: any;
  let emitter: any;
  let registry: any;
  let config: any;
  let service: PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    db = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...payment,
          status: 'SUCCEEDED',
          providerRef: 'provider-1',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      paymentAttempt: {
        create: jest.fn().mockResolvedValue({}),
      },
      bookingStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      booking: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    emitter = { emit: jest.fn() };
    registry = {
      get: jest.fn().mockReturnValue({
        initiate: jest.fn().mockResolvedValue({ providerRef: 'provider-1' }),
        confirm: jest.fn().mockResolvedValue({
          approved: true,
          status: 'COMPLETED',
        }),
        refund: jest.fn().mockResolvedValue({ success: true }),
        charge: jest.fn().mockResolvedValue({
          approved: true,
          providerRef: 'provider-1',
        }),
      }),
    };
    config = {
      // `mockCallback` guards on nodeEnv before it ever looks at the secret,
      // and several gateway paths read feature keys through `get`.
      get: jest.fn((key: string) => (key === 'nodeEnv' ? 'test' : undefined)),
      getOrThrow: jest.fn().mockReturnValue('test-webhook-secret'),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new PaymentService(
      db as PrismaService,
      emitter as EventEmitter2,
      registry,
      config as ConfigService,
      audit as any,
    );
  });

  it('rejects callbacks without the configured webhook secret', async () => {
    await expect(
      service.mockCallback('booking-1', {}, 'wrong-secret'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.payment.findUnique).not.toHaveBeenCalled();
  });

  it('emits completion only when the conditional payment update wins', async () => {
    await service.mockCallback(
      'booking-1',
      { status: 'SUCCEEDED', reference: '4242' },
      'test-webhook-secret',
    );
    expect(db.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PENDING', 'PENDING_AT_HOTEL', 'FAILED'] },
        }),
      }),
    );
    expect(db.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: 'SUCCEEDED' }),
      }),
    );
    expect(emitter.emit).toHaveBeenCalledTimes(1);

    db.payment.findUnique.mockResolvedValue({
      ...payment,
      status: 'SUCCEEDED',
      providerRef: 'provider-1',
    });
    const replay = await service.mockCallback(
      'booking-1',
      { status: 'SUCCEEDED', reference: '4242' },
      'test-webhook-secret',
    );
    expect(replay.idempotent).toBe(true);
    expect(emitter.emit).toHaveBeenCalledTimes(1);
  });

  it('refunds an owner-authorized successful payment with policy-based amount and emits once', async () => {
    db.payment.findUnique.mockResolvedValue({
      ...payment,
      status: 'SUCCEEDED',
      providerRef: 'provider-1',
      booking: {
        ...payment.booking,
        status: 'CANCELLED',
      },
    });

    const result = await service.refund('booking-1', {
      sub: 'user-1',
      role: 'CUSTOMER',
    });

    expect(result.status).toBe('REFUNDED');
    expect(result.idempotent).toBe(false);
    expect(result.refundAmount).toBe(100);
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'SUCCEEDED' },
      data: {
        status: 'REFUNDED',
        refundAmount: 100,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        refundedAt: expect.any(Date),
      },
    });
  });

  it('records failed attempt and throws HTTP 402 when status is FAILED', async () => {
    const mockFraud = {
      checkPaymentFailureVelocity: jest.fn().mockResolvedValue(false),
    };
    (service as any).fraud = mockFraud;

    await expect(
      service.mockCallback(
        'booking-1',
        { status: 'FAILED', reference: 'fail' },
        'test-webhook-secret',
      ),
    ).rejects.toThrow(HttpException);

    expect(db.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: 'FAILED' }),
      }),
    );
    expect(mockFraud.checkPaymentFailureVelocity).toHaveBeenCalledWith(
      'user-1',
    );
  });

  describe('Chapa webhook & live verification security', () => {
    it('rejects webhook when HMAC signature fails', async () => {
      const mockChapaService = {
        verifySignature: jest.fn().mockReturnValue(false),
        verify: jest.fn(),
      };
      (service as any).chapaService = mockChapaService;

      await expect(
        service.handleWebhook(
          'CHP-YT-20260926-TEST01',
          { status: 'SUCCESS', amount: 100 },
          Buffer.from('raw body'),
          'invalid-signature',
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('re-verifies status server-to-server and confirms payment when signature and amount match', async () => {
      const mockChapaService = {
        verifySignature: jest.fn().mockReturnValue(true),
        verify: jest.fn().mockResolvedValue({
          status: 'success',
          data: {
            status: 'success',
            amount: 100,
            currency: 'ETB',
            tx_ref: 'CHP-YT-20260926-TEST01',
          },
        }),
      };
      (service as any).chapaService = mockChapaService;
      config.get = jest.fn((k: string) =>
        k === 'payment.chapaSecretKey' ? 'secret' : undefined,
      );

      db.payment.findFirst = jest.fn().mockResolvedValue({
        id: 'payment-1',
        bookingId: 'booking-1',
        provider: 'CHAPA',
        method: 'TELEBIRR',
        amount: { toNumber: () => 100 },
        currency: 'ETB',
        status: 'PENDING',
        booking: {
          id: 'booking-1',
          userId: 'user-1',
          status: 'PENDING',
          totalPrice: { toNumber: () => 100 },
        },
      });
      db.paymentEvent = { create: jest.fn().mockResolvedValue({}) };

      const result = await service.handleWebhook(
        'CHP-YT-20260926-TEST01',
        { status: 'SUCCESS', amount: 100 },
        Buffer.from('body'),
        'valid-sig',
      );

      expect(result.status).toBe('SUCCEEDED');
      expect(mockChapaService.verify).toHaveBeenCalledWith(
        'CHP-YT-20260926-TEST01',
      );
      expect(db.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'payment-1',
            status: {
              in: [
                'PENDING',
                'PENDING_AT_HOTEL',
                'OTP_SENT',
                'PROCESSING',
                'FAILED',
              ],
            },
          },
          data: expect.objectContaining({ status: 'SUCCEEDED' }),
        }),
      );
    });

    it('rejects webhook when amount differs from booking total price', async () => {
      const mockChapaService = {
        verifySignature: jest.fn().mockReturnValue(true),
        verify: jest.fn().mockResolvedValue({
          status: 'success',
          data: {
            status: 'success',
            amount: 10, // attacker claims 10 instead of 100
            currency: 'ETB',
            tx_ref: 'CHP-YT-20260926-TEST01',
          },
        }),
      };
      (service as any).chapaService = mockChapaService;
      config.get = jest.fn((k: string) =>
        k === 'payment.chapaSecretKey' ? 'secret' : undefined,
      );

      db.payment.findFirst = jest.fn().mockResolvedValue({
        id: 'payment-1',
        bookingId: 'booking-1',
        provider: 'CHAPA',
        method: 'TELEBIRR',
        amount: { toNumber: () => 100 },
        currency: 'ETB',
        status: 'PENDING',
        booking: {
          id: 'booking-1',
          userId: 'user-1',
          totalPrice: { toNumber: () => 100 },
        },
      });

      await expect(
        service.handleWebhook(
          'CHP-YT-20260926-TEST01',
          { status: 'SUCCESS', amount: 10 },
          Buffer.from('body'),
          'valid-sig',
        ),
      ).rejects.toThrow();
    });
  });
});
