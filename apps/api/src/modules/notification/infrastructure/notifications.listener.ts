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
      bookingRef: booking.bookingRef,
      hotelName: booking.hotel.name,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      total,
    };

    await this.dispatchAllChannels(
      booking.userId,
      NOTIFICATION_TYPES.BOOKING_CREATED,
      payload,
    );

    await this.mail.enqueueBookingConfirmation(booking.user.email, {
      bookingRef: booking.bookingRef,
      hotelName: booking.hotel.name,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      total,
    });
  }

  @OnEvent(BookingEventNames.CANCELLED)
  async onBookingCancelled(event: BookingCancelledEvent) {
    const booking = await this.db.booking.findUnique({
      where: { id: event.bookingId },
      include: {
        user: true,
        hotel: { select: { name: true } },
        payment: true,
      },
    });
    if (!booking) return;
    const payload = {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      hotelName: booking.hotel.name,
    };

    await this.dispatchAllChannels(
      booking.userId,
      NOTIFICATION_TYPES.BOOKING_CANCELLATION,
      payload,
    );

    await this.mail.enqueueBookingCancellation(booking.user.email, {
      bookingRef: booking.bookingRef,
      refundAmount: booking.payment?.refundAmount?.toNumber(),
    });
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
    const payload = {
      bookingId: payment.bookingId,
      bookingRef: payment.booking.bookingRef,
      hotelName: payment.booking.hotel.name,
      amount,
      method: payment.method,
      providerRef: payment.providerRef,
    };

    await this.dispatchAllChannels(
      payment.booking.userId,
      NOTIFICATION_TYPES.PAYMENT_RECEIVED,
      payload,
    );

    await this.mail.enqueuePaymentReceipt(payment.booking.user.email, {
      bookingRef: payment.booking.bookingRef,
      amount,
      method: payment.method,
      providerRef: payment.providerRef,
    });
  }

  @OnEvent(PaymentEventNames.REFUNDED)
  async onPaymentRefunded(event: PaymentRefundedEvent) {
    const booking = await this.db.booking.findUnique({
      where: { id: event.bookingId },
      include: { user: true, hotel: { select: { name: true } } },
    });
    if (!booking) return;
    const amount = event.amount;
    const payload = {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      hotelName: booking.hotel.name,
      amount,
      method: event.method,
    };

    await this.dispatchAllChannels(
      booking.userId,
      NOTIFICATION_TYPES.PAYMENT_REFUNDED,
      payload,
    );
  }

  private async dispatchAllChannels(
    userId: string,
    type: string,
    payload: Prisma.InputJsonValue,
  ) {
    await Promise.all([
      this.notifications.notify({
        userId,
        type,
        channel: NOTIFICATION_CHANNELS.IN_APP,
        payload,
      }),
      this.notifications.notify({
        userId,
        type,
        channel: NOTIFICATION_CHANNELS.EMAIL,
        payload,
      }),
      this.notifications.notify({
        userId,
        type,
        channel: NOTIFICATION_CHANNELS.PUSH,
        payload,
      }),
    ]);
  }
}
