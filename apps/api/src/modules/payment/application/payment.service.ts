import {
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
import {
  PaymentCompletedEvent,
  PaymentRefundedEvent,
  PaymentEventNames,
} from '../../events/payment.events';
import type { MockGatewayCallback, PaymentMethod } from '@repo/shared-types';

@Injectable()
export class PaymentService {
  constructor(
    private readonly db: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly registry: PaymentGatewayRegistry,
    private readonly config: ConfigService,
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
            hotel: { select: { id: true, name: true } },
            checkIn: true,
            checkOut: true,
          },
        },
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
      return {
        status: 'SUCCEEDED' as const,
        paymentId: payment.id,
        transactionId: updated.providerRef ?? null,
        idempotent: false,
      };
    }

    await this.db.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        providerRef: result.providerRef ?? body.transactionId ?? null,
      },
    });
    return { status: 'FAILED' as const, paymentId: payment.id };
  }

  async refund(bookingId: string, actor: { sub: string; role: string }) {
    const payment = await this.db.payment.findUnique({
      where: { bookingId },
      include: { booking: { include: { hotel: { select: { managerId: true } } } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const isOwner =
      payment.booking.userId === actor.sub && payment.booking.status === 'CANCELLED';
    const isPlatformOperator = ['STAFF', 'ADMIN'].includes(actor.role);
    const isHotelManager =
      actor.role === 'MANAGER' && payment.booking.hotel.managerId === actor.sub;
    if (!isOwner && !isPlatformOperator && !isHotelManager) {
      throw new ForbiddenException('You cannot refund this booking');
    }
    if (payment.status === 'REFUNDED') {
      return { status: 'REFUNDED' as const, paymentId: payment.id, idempotent: true };
    }
    if (payment.status !== 'SUCCEEDED') {
      throw new ConflictException('Only a successful payment can be refunded');
    }
    const changed = await this.db.payment.updateMany({
      where: { id: payment.id, status: 'SUCCEEDED' },
      data: { status: 'REFUNDED' },
    });
    if (changed.count === 0) {
      return { status: 'REFUNDED' as const, paymentId: payment.id, idempotent: true };
    }
    this.emitter.emit(
      PaymentEventNames.REFUNDED,
      new PaymentRefundedEvent(
        payment.id,
        bookingId,
        payment.booking.userId,
        payment.amount.toNumber(),
        payment.method,
      ),
    );
    return { status: 'REFUNDED' as const, paymentId: payment.id, idempotent: false };
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
