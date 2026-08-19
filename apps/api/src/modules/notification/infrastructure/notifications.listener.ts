import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MailProducer } from '../../jobs/mail.producer';
import {
  BookingCancelledEvent,
  BookingCreatedEvent,
  BookingEventNames,
} from '../../events/booking.events';
import {
  PaymentCompletedEvent,
  PaymentEventNames,
  PaymentRefundedEvent,
} from '../../events/payment.events';
import { NotificationService } from '../application/notification.service';
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from '../domain';

@Injectable()
export class NotificationsListener {
  constructor(
    private readonly db: PrismaService,
    private readonly notifications: NotificationService,
    private readonly mail: MailProducer,
  ) {}

  @OnEvent(BookingEventNames.CREATED)
  async onBookingCreated(event: BookingCreatedEvent) {
    const booking = await this.db.booking.findUnique({
      where: { id: event.bookingId },
      include: { user: true, hotel: { select: { name: true } } },
    });
    if (!booking) return;
    const total = booking.totalPrice.toNumber();
    const payload = {
      bookingId: booking.id,
      hotelName: booking.hotel.name,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      total,
    };
    await this.notifyAndEmail(
      booking.userId,
      booking.user.email,
      NOTIFICATION_TYPES.BOOKING_CREATED,
      payload,
      `Booking request received at ${booking.hotel.name}`,
      `<p>Your booking at <strong>${booking.hotel.name}</strong> has been received and is awaiting confirmation.</p><p>Total (incl. 5% service fee): $${total.toFixed(2)}</p>`,
    );
  }

  @OnEvent(BookingEventNames.CANCELLED)
  async onBookingCancelled(event: BookingCancelledEvent) {
    const booking = await this.db.booking.findUnique({
      where: { id: event.bookingId },
      include: { user: true, hotel: { select: { name: true } } },
    });
    if (!booking) return;
    await this.notifyAndEmail(
      booking.userId,
      booking.user.email,
      NOTIFICATION_TYPES.BOOKING_CANCELLATION,
      { bookingId: booking.id, hotelName: booking.hotel.name },
      `Booking cancelled at ${booking.hotel.name}`,
      `<p>Your booking at <strong>${booking.hotel.name}</strong> has been cancelled.</p>`,
    );
  }

  @OnEvent(PaymentEventNames.COMPLETED)
  async onPaymentCompleted(event: PaymentCompletedEvent) {
    const payment = await this.db.payment.findUnique({
      where: { bookingId: event.bookingId },
      include: {
        booking: { include: { user: true, hotel: { select: { name: true } } } },
      },
    });
    if (!payment) return;
    const amount = payment.amount.toNumber();
    await this.notifyAndEmail(
      payment.booking.userId,
      payment.booking.user.email,
      NOTIFICATION_TYPES.PAYMENT_REFUNDED,
      {
        bookingId: payment.bookingId,
        hotelName: payment.booking.hotel.name,
        amount,
        method: payment.method,
      },
      `Payment received - $${amount.toFixed(2)}`,
      `<p>Your payment of <strong>$${amount.toFixed(2)}</strong> for ${payment.booking.hotel.name} was received.</p>`,
    );
  }

  @OnEvent(PaymentEventNames.REFUNDED)
  async onPaymentRefunded(event: PaymentRefundedEvent) {
    const booking = await this.db.booking.findUnique({
      where: { id: event.bookingId },
      include: { user: true, hotel: { select: { name: true } } },
    });
    if (!booking) return;
    const amount = event.amount;
    await this.notifyAndEmail(
      booking.userId,
      booking.user.email,
      NOTIFICATION_TYPES.PAYMENT_RECEIVED,
      {
        bookingId: booking.id,
        hotelName: booking.hotel.name,
        amount,
        method: event.method,
      },
      `Refund issued - $${amount.toFixed(2)}`,
      `<p>Your payment of <strong>$${amount.toFixed(2)}</strong> for ${booking.hotel.name} has been refunded.</p>`,
    );
  }

  private async notifyAndEmail(
    userId: string,
    to: string,
    type: string,
    payload: Prisma.InputJsonValue,
    subject: string,
    html: string,
  ) {
    await this.notifications.notify({
      userId,
      type,
      channel: NOTIFICATION_CHANNELS.EMAIL,
      payload,
    });
    await this.mail.enqueue({ to, subject, html });
  }
}
