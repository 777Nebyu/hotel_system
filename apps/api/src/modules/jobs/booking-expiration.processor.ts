import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EXPIRATION_QUEUE } from './jobs.constants';
import { BOOKING_EXPIRATION_JOB } from './booking-expiration.scheduler';
import { MailProducer } from './mail.producer';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import {
  BookingCancelledEvent,
  BookingEventNames,
} from '../events/booking.events';

@Processor(EXPIRATION_QUEUE)
export class BookingExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingExpirationProcessor.name);

  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailProducer,
    private readonly audit: AuditService,
    private readonly emitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== BOOKING_EXPIRATION_JOB) return;

    const cutoff = new Date(Date.now() - 30 * 60 * 1000);

    const expiredBookings = await this.db.booking.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
        OR: [
          { payment: null },
          {
            payment: {
              status: { not: 'SUCCEEDED' },
              method: { not: 'CASH' },
            },
          },
        ],
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        hotel: { select: { id: true, name: true } },
        payment: true,
      },
    });

    this.logger.log(`Found ${expiredBookings.length} pending bookings exceeding 30m timeout`);

    for (const booking of expiredBookings) {
      await this.db.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED' },
        });
        if (booking.payment && booking.payment.status === 'PENDING') {
          await tx.payment.update({
            where: { bookingId: booking.id },
            data: { status: 'FAILED' },
          });
        }
      });

      this.emitter.emit(
        BookingEventNames.CANCELLED,
        new BookingCancelledEvent(booking.id, booking.user.id, booking.hotel.id),
      );

      await this.audit.record(
        booking.user.id,
        'BOOKING_AUTO_CANCELLED',
        'Booking',
        booking.id,
        { reason: 'Payment timeout (30 minutes)' },
      );

      await this.mail.enqueueBookingCancellation(booking.user.email, {
        bookingRef: booking.bookingRef,
      });
    }

    const expiredHolds = await this.db.roomHold.updateMany({
      where: {
        status: 'ACTIVE',
        holdEnd: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (expiredHolds.count > 0) {
      this.logger.log(`Expired ${expiredHolds.count} active room holds`);
    }
  }
}
