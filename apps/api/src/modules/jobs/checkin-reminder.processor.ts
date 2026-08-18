import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { REMINDER_QUEUE } from './jobs.module';
import { MailProducer } from './mail.producer';
import { CHECKIN_REMINDER_JOB } from './checkin-reminder.scheduler';
import { PrismaService } from '../../prisma/prisma.service';

@Processor(REMINDER_QUEUE)
export class CheckInReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(CheckInReminderProcessor.name);

  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailProducer,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== CHECKIN_REMINDER_JOB) return;

    const tomorrowStart = new Date();
    tomorrowStart.setHours(0, 0, 0, 0);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const bookings = await this.db.booking.findMany({
      where: {
        status: 'CONFIRMED',
        checkIn: { gte: tomorrowStart, lt: tomorrowEnd },
      },
      include: {
        user: { select: { fullName: true, email: true } },
        hotel: { select: { name: true } },
      },
    });

    this.logger.log(`Found ${bookings.length} bookings checking in tomorrow`);
    for (const booking of bookings) {
      await this.mail.enqueue({
        to: booking.user.email,
        subject: 'Check-in reminder',
        html: `Hi ${booking.user.fullName},<br/>Your stay at <b>${booking.hotel.name}</b> starts tomorrow.<br/>See you there!`,
      });
    }
  }
}