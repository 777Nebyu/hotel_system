import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentGatewayRegistry } from '../infrastructure/gateway-registry';
import {
  PaymentCompletedEvent,
  PaymentEventNames,
} from '../../events/payment.events';
import type { MockGatewayCallback, PaymentMethod } from '@repo/shared-types';

@Injectable()
export class PaymentService {
  constructor(
    private readonly db: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly registry: PaymentGatewayRegistry,
  ) {}

  async createIntent(
    bookingId: string,
    method: PaymentMethod,
    userId: string,
  ) {
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

  async mockCallback(bookingId: string, body: MockGatewayCallback) {
    const payment = await this.db.payment.findUnique({
      where: { bookingId },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const gateway = this.registry.get(payment.method);
    const result = await gateway.charge({
      amount: payment.amount.toNumber(),
      reference: body.reference ?? payment.providerRef ?? 'default',
    });

    if (result.approved) {
      const updated = await this.db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          providerRef: result.providerRef ?? body.transactionId ?? null,
        },
      });
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
}