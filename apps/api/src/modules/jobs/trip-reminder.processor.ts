import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { REMINDER_QUEUE } from './jobs.constants';
import { TRIP_REMINDER_JOB } from './trip-reminder.scheduler';
import { PrismaService } from '../../prisma/prisma.service';
import { MailProducer } from './mail.producer';

@Processor(REMINDER_QUEUE)
export class TripReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(TripReminderProcessor.name);

  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailProducer,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== TRIP_REMINDER_JOB) return;

    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endDay = new Date(Date.UTC(horizon.getUTCFullYear(), horizon.getUTCMonth(), horizon.getUTCDate()));
    const items = await this.db.tripItem.findMany({
      where: {
        status: 'PLANNED',
        startTime: { not: null },
        reminderSentAt: null,
        dayDate: { gte: startDay, lte: endDay },
        trip: { deletedAt: null },
      },
      include: {
        trip: {
          select: {
            id: true,
            userId: true,
            title: true,
            timezone: true,
            user: { select: { email: true, fullName: true } },
          },
        },
        place: { select: { name: true } },
      },
    });

    let sent = 0;
    for (const item of items) {
      if (!item.startTime) continue;
      const [hours, minutes] = item.startTime.split(':').map(Number);
      const startsAt = new Date(item.dayDate);
      startsAt.setUTCHours(hours, minutes, 0, 0);
      if (startsAt < now || startsAt > horizon) continue;

      const claimed = await this.db.tripItem.updateMany({
        where: { id: item.id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
      if (claimed.count !== 1) continue;

      const placeName = item.place?.name ? ` at ${item.place.name}` : '';
      const message = `${item.title}${placeName} starts at ${item.startTime}.`;
      await this.db.notification.create({
        data: {
          userId: item.trip.userId,
          type: 'trip_reminder',
          channel: 'IN_APP',
          payload: {
            title: `Upcoming itinerary: ${item.trip.title}`,
            message,
            tripId: item.trip.id,
            tripItemId: item.id,
            startsAt: startsAt.toISOString(),
          },
          sentAt: new Date(),
        },
      });
      await this.mail.enqueue({
        to: item.trip.user.email,
        subject: `Upcoming itinerary: ${item.title}`,
        html: `Hi ${item.trip.user.fullName},<br/>${message}<br/>Your trip is <b>${item.trip.title}</b>.`,
      });
      sent += 1;
    }

    this.logger.log(`Sent ${sent} itinerary reminder(s)`);
  }
}
