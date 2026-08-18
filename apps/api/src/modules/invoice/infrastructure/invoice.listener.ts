import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PaymentCompletedEvent,
  PaymentEventNames,
} from '../../events/payment.events';

@Injectable()
export class InvoiceListener {
  constructor(private readonly db: PrismaService) {}

  @OnEvent(PaymentEventNames.COMPLETED)
  async onPaymentCompleted(event: PaymentCompletedEvent) {
    await this.db.payment.update({
      where: { bookingId: event.bookingId },
      data: { invoiceUrl: `/bookings/${event.bookingId}/invoice` },
    });
  }
}
