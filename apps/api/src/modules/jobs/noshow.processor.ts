import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOSHOW_QUEUE } from './jobs.constants';
import { NOSHOW_DETECTION_JOB } from './noshow.scheduler';
import { MailProducer } from './mail.producer';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';

@Processor(NOSHOW_QUEUE)
export class NoShowProcessor extends WorkerHost {
  private readonly logger = new Logger(NoShowProcessor.name);

  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailProducer,
    private readonly audit: AuditService,
    private readonly emitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== NOSHOW_DETECTION_JOB) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const noShowBookings = await this.db.booking.findMany({
      where: {
        status: 'CONFIRMED',
        checkIn: { lt: todayStart },
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        hotel: { select: { id: true, name: true } },
        details: { select: { roomId: true } },
      },
    });

    if (!noShowBookings.length) return;

    this.logger.log(`Found ${noShowBookings.length} confirmed bookings past check-in date without check-in`);

    for (const booking of noShowBookings) {
      await this.db.booking.update({
        where: { id: booking.id },
        data: { status: 'NO_SHOW' },
      });

      const roomIds = booking.details.map((d) => d.roomId);
      await this.db.roomAvailability.deleteMany({
        where: {
          roomId: { in: roomIds },
          date: { gte: booking.checkIn, lt: booking.checkOut },
          status: 'UNAVAILABLE',
        },
      });

      await this.audit.record(
        'system',
        'BOOKING_NO_SHOW',
        'Booking',
        booking.id,
        { reason: 'Check-in date passed without guest arrival' },
      );

      await this.mail.enqueue({
        to: booking.user.email,
        subject: 'Booking Marked as No-Show',
        html: `Hi ${booking.user.fullName},<br/>Your booking at <b>${booking.hotel.name}</b> has been marked as No-Show because check-in was not completed. In accordance with policy, payment has been retained and room availability has been released.`,
      });
    }
  }
}
