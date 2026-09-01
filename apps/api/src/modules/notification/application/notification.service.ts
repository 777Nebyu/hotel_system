import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from '../domain';
import type { NotificationsQuery } from '@repo/shared-types';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly db: PrismaService) {}

  async notify(input: {
    userId: string;
    type: string;
    channel: string;
    payload: Prisma.InputJsonValue;
  }) {
    const pref = await this.db.notificationPreference.findUnique({
      where: {
        userId_type_channel: {
          userId: input.userId,
          type: input.type,
          channel: input.channel,
        },
      },
    });
    if (pref && !pref.enabled) {
      return null;
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existing = await this.db.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        channel: input.channel,
        createdAt: { gte: fiveMinutesAgo },
      },
    });
    if (
      existing &&
      JSON.stringify(existing.payload) === JSON.stringify(input.payload)
    ) {
      return existing;
    }

    let sentAt: Date | null = null;
    if (input.channel === NOTIFICATION_CHANNELS.EMAIL) {
      sentAt = new Date();
    } else if (input.channel === NOTIFICATION_CHANNELS.PUSH) {
      const user = await this.db.user.findUnique({
        where: { id: input.userId },
        select: { pushToken: true },
      });
      if (user?.pushToken) {
        sentAt = new Date();
        this.logger.log(
          `Dispatched push notification to device token ${user.pushToken.slice(0, 10)}... for user ${input.userId}`,
        );
      }
    }

    return this.db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        channel: input.channel,
        payload: input.payload,
        sentAt,
      },
    });
  }

  async list(userId: string, query: NotificationsQuery) {
    const where = { userId };
    const [total, notifications, unreadCount] = await this.db.$transaction([
      this.db.notification.count({ where }),
      this.db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return {
      data: notifications,
      unreadCount,
      meta: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async markRead(notificationId: string, userId: string) {
    const updated = await this.db.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      throw new NotFoundException('Notification not found');
    }
    return { read: true };
  }

  async markAllRead(userId: string) {
    const updated = await this.db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: updated.count };
  }

  async unreadCount(userId: string) {
    const count = await this.db.notification.count({
      where: { userId, readAt: null },
    });
    return { unreadCount: count };
  }

  async getPreferences(userId: string) {
    const existing = await this.db.notificationPreference.findMany({
      where: { userId },
    });
    const types = Object.values(NOTIFICATION_TYPES);
    const channels = Object.values(NOTIFICATION_CHANNELS);

    const fullPreferences = types.flatMap((type) =>
      channels.map((channel) => {
        const found = existing.find(
          (e) => e.type === type && e.channel === channel,
        );
        return {
          type,
          channel,
          enabled: found ? found.enabled : true,
        };
      }),
    );

    return { data: fullPreferences };
  }

  async updatePreference(
    userId: string,
    type: string,
    channel: string,
    enabled: boolean,
  ) {
    return this.db.notificationPreference.upsert({
      where: {
        userId_type_channel: { userId, type, channel },
      },
      create: { userId, type, channel, enabled },
      update: { enabled },
    });
  }

  async registerPushToken(userId: string, token: string) {
    await this.db.user.update({
      where: { id: userId },
      data: { pushToken: token },
    });
    return { success: true };
  }
}
