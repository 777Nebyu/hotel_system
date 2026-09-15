import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UserRegisteredEvent,
  BookingCreatedEvent,
  BookingCancelledEvent,
  PaymentCompletedEvent,
} from './domain-events';

@Injectable()
export class DomainEventsListener {
  private readonly logger = new Logger(DomainEventsListener.name);

  constructor(private db: PrismaService) {}

  @OnEvent('user.registered', { async: true })
  async handleUserRegistered(event: UserRegisteredEvent) {
    this.logger.log(`[DomainEvent] user.registered for user: ${event.userId}`);
    await this.db.auditLog.create({
      data: {
        actorId: event.userId,
        action: 'USER_REGISTERED',
        entity: 'User',
        entityId: event.userId,
        diff: { email: event.email, fullName: event.fullName },
      },
    });
  }

  @OnEvent('booking.created', { async: true })
  async handleBookingCreated(event: BookingCreatedEvent) {
    this.logger.log(`[DomainEvent] booking.created ID: ${event.bookingId}`);
    await this.db.auditLog.create({
      data: {
        actorId: event.userId,
        action: 'BOOKING_CREATED',
        entity: 'Booking',
        entityId: event.bookingId,
        diff: { hotelId: event.hotelId, totalPrice: event.totalPrice },
      },
    });
  }

  @OnEvent('booking.cancelled', { async: true })
  async handleBookingCancelled(event: BookingCancelledEvent) {
    this.logger.log(`[DomainEvent] booking.cancelled ID: ${event.bookingId}`);
    await this.db.auditLog.create({
      data: {
        actorId: event.userId,
        action: 'BOOKING_CANCELLED',
        entity: 'Booking',
        entityId: event.bookingId,
        diff: { reason: event.reason },
      },
    });
  }

  @OnEvent('payment.completed', { async: true })
  async handlePaymentCompleted(event: PaymentCompletedEvent) {
    this.logger.log(`[DomainEvent] payment.completed ID: ${event.paymentId}`);
    await this.db.auditLog.create({
      data: {
        action: 'PAYMENT_COMPLETED',
        entity: 'Payment',
        entityId: event.paymentId,
        diff: {
          bookingId: event.bookingId,
          amount: event.amount,
          method: event.method,
        },
      },
    });
  }
}
