import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NOTIFICATION_CHANNELS } from '../domain';
import type { NotificationsQuery } from '@repo/shared-types';

@Injectable()
export class NotificationService {
  constructor(private readonly db: PrismaService) {}

  async notify(input: {
    userId: string;
    type: string;
    channel: string;
    payload: Prisma.InputJsonValue;
  }) {
    return this.db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        channel: input.channel,
        payload: input.payload,
        sentAt:
          input.channel === NOTIFICATION_CHANNELS.EMAIL ? new Date() : null,
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
}
