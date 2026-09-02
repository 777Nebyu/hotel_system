import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentGatewayRegistry } from '../infrastructure/gateway-registry';
import { AuditService } from '../../../common/services/audit.service';
import {
  PaymentCompletedEvent,
  PaymentRefundedEvent,
  PaymentEventNames,
} from '../../events/payment.events';
import type { MarkCashPaidInput, MockGatewayCallback, PaymentMethod } from '@repo/shared-types';

function calculateRefundAmount(
  paidAmount: number,
  checkIn: Date,
  cancelledAt: Date = new Date(),
): number {
  const daysUntilCheckIn = Math.floor(
    (checkIn.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysUntilCheckIn >= 7) return Math.round(paidAmount * 100) / 100;
  if (daysUntilCheckIn >= 3) return Math.round(paidAmount * 0.5 * 100) / 100;
  return 0;
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly db: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly registry: PaymentGatewayRegistry,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async createIntent(bookingId: string, method: PaymentMethod, userId: string) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You cannot pay for this booking');
    }
    if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
      throw new ConflictException('This booking can no longer be paid');
    }

    const payment = await this.db.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        method,
        amount: booking.totalPrice,
        status: 'PENDING',
      },
      update: { method, status: 'PENDING', providerRef: null },
    });

    return {
      paymentId: payment.id,
      bookingId: booking.id,
      method,
      amount: payment.amount.toNumber(),
      status: payment.status,
      redirectUrl: `/payments/mock/${booking.id}`,
    };
  }

  async myPayments(userId: string) {
    const payments = await this.db.payment.findMany({
      where: { booking: { userId } },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            bookingRef: true,
            hotel: { select: { id: true, name: true } },
            checkIn: true,
            checkOut: true,
          },
        },
        attempts: { orderBy: { attemptedAt: 'desc' }, take: 5 },
      },
    });
    return { data: payments };
  }

  async mockCallback(
    bookingId: string,
    body: MockGatewayCallback,
    webhookSecret: string | undefined,
  ) {
    this.assertMockWebhookSecret(webhookSecret);
    const payment = await this.db.payment.findUnique({
      where: { bookingId },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'SUCCEEDED') {
      return {
        status: 'SUCCEEDED' as const,
        paymentId: payment.id,
        transactionId: payment.providerRef,
        idempotent: true,
      };
    }
    if (payment.status === 'REFUNDED') {
      throw new ConflictException('A refunded payment cannot be completed');
    }

    const gateway = this.registry.get(payment.method);
    const result = await gateway.charge({
      amount: payment.amount.toNumber(),
      reference: body.reference ?? payment.providerRef ?? 'default',
    });

    if (result.approved) {
      const changed = await this.db.payment.updateMany({
        where: { id: payment.id, status: { in: ['PENDING', 'FAILED'] } },
        data: {
          status: 'SUCCEEDED',
          providerRef: result.providerRef ?? body.transactionId ?? null,
        },
      });

      await this.db.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          method: payment.method,
          outcome: 'SUCCEEDED',
          providerRef: result.providerRef ?? body.transactionId ?? null,
        },
      });

      const updated = await this.db.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      if (changed.count === 0) {
        return {
          status: updated.status,
          paymentId: payment.id,
          transactionId: updated.providerRef,
          idempotent: true,
        };
      }
      this.emitter.emit(
        PaymentEventNames.COMPLETED,
        new PaymentCompletedEvent(
          payment.id,
          bookingId,
          payment.booking.userId,
          payment.amount.toNumber(),
          updated.method,
        ),
      );
      await this.audit.record(
        payment.booking.userId,
        'PAYMENT_COMPLETED',
        'Payment',
        payment.id,
        { bookingId, method: updated.method, amount: payment.amount.toNumber() },
      );
      return {
        status: 'SUCCEEDED' as const,
        paymentId: payment.id,
        transactionId: updated.providerRef ?? null,
        idempotent: false,
      };
    }

    await this.db.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        method: payment.method,
        outcome: 'FAILED',
        providerRef: result.providerRef ?? body.transactionId ?? null,
      },
    });

    await this.db.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        providerRef: result.providerRef ?? body.transactionId ?? null,
      },
    });
    return { status: 'FAILED' as const, paymentId: payment.id };
  }

  async markCashPaid(
    bookingId: string,
    body: MarkCashPaidInput,
    actor: { sub: string; role: string; hotelId?: string },
  ) {
    const payment = await this.db.payment.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: { hotel: { select: { id: true, managerId: true } } },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.method !== 'CASH') {
      throw new BadRequestException(
        'Only CASH payments can be marked as paid via this endpoint',
      );
    }

    const hotelId = payment.booking.hotel.id;
    if (actor.role === 'MANAGER') {
      if (actor.hotelId !== hotelId) {
        throw new ForbiddenException(
          'You can only mark payments for your own hotel',
        );
      }
    } else if (actor.role === 'STAFF') {
      if (actor.hotelId !== hotelId) {
        throw new ForbiddenException(
          'You can only mark payments for your assigned hotel',
        );
      }
    } else if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (payment.status === 'SUCCEEDED') {
      return {
        status: 'SUCCEEDED' as const,
        paymentId: payment.id,
        idempotent: true,
      };
    }
    if (payment.status === 'REFUNDED') {
      throw new ConflictException('A refunded payment cannot be completed');
    }

    const ref = body.reference ?? `CASH-${Date.now()}`;

    await this.db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED', providerRef: ref },
      });
      await tx.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          method: 'CASH',
          outcome: 'SUCCEEDED',
          providerRef: ref,
        },
      });
    });

    this.emitter.emit(
      PaymentEventNames.COMPLETED,
      new PaymentCompletedEvent(
        payment.id,
        bookingId,
        payment.booking.userId,
        payment.amount.toNumber(),
        'CASH',
      ),
    );

    await this.audit.record(
      actor.sub,
      'PAYMENT_CASH_PAID',
      'Payment',
      payment.id,
      { bookingId, amount: payment.amount.toNumber() },
    );

    return {
      status: 'SUCCEEDED' as const,
      paymentId: payment.id,
      idempotent: false,
    };
  }

  async refund(bookingId: string, actor: { sub: string; role: string }) {
    const payment = await this.db.payment.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: {
            hotel: { select: { managerId: true } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const isOwner =
      payment.booking.userId === actor.sub &&
      payment.booking.status === 'CANCELLED';
    const isPlatformOperator = ['STAFF', 'ADMIN'].includes(actor.role);
    const isHotelManager =
      actor.role === 'MANAGER' &&
      payment.booking.hotel.managerId === actor.sub;

    if (!isOwner && !isPlatformOperator && !isHotelManager) {
      throw new ForbiddenException('You cannot refund this booking');
    }
    if (payment.status === 'REFUNDED') {
      return {
        status: 'REFUNDED' as const,
        paymentId: payment.id,
        refundAmount: payment.refundAmount?.toNumber() ?? 0,
        idempotent: true,
      };
    }
    if (payment.status !== 'SUCCEEDED') {
      throw new ConflictException('Only a successful payment can be refunded');
    }

    const refundAmount = isPlatformOperator
      ? payment.amount.toNumber()
      : calculateRefundAmount(
          payment.amount.toNumber(),
          payment.booking.checkIn,
        );

    const changed = await this.db.payment.updateMany({
      where: { id: payment.id, status: 'SUCCEEDED' },
      data: {
        status: 'REFUNDED',
        refundAmount,
        refundedAt: new Date(),
      },
    });
    if (changed.count === 0) {
      return {
        status: 'REFUNDED' as const,
        paymentId: payment.id,
        refundAmount: payment.refundAmount?.toNumber() ?? refundAmount,
        idempotent: true,
      };
    }

    this.emitter.emit(
      PaymentEventNames.REFUNDED,
      new PaymentRefundedEvent(
        payment.id,
        bookingId,
        payment.booking.userId,
        refundAmount,
        payment.method,
      ),
    );
    await this.audit.record(
      actor.sub,
      'PAYMENT_REFUNDED',
      'Payment',
      payment.id,
      { bookingId, refundAmount, method: payment.method },
    );
    return {
      status: 'REFUNDED' as const,
      paymentId: payment.id,
      refundAmount,
      idempotent: false,
    };
  }

  private assertMockWebhookSecret(received: string | undefined) {
    const expected = this.config.getOrThrow<string>('payment.mockWebhookSecret');
    if (!received) throw new UnauthorizedException('Missing payment webhook secret');
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid payment webhook secret');
    }
  }
}
