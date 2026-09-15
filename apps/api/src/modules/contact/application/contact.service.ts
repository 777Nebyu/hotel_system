import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import { NotificationService } from '../../notification/application/notification.service';
import { NOTIFICATION_CHANNELS } from '../../notification/domain';
import type {
  CreateContactThreadInput,
  SendContactMessageInput,
  UpdateContactStatusInput,
} from '@repo/shared-types';

export interface ContactActor {
  sub: string;
  role: string;
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  async createThread(
    hotelId: string,
    dto: CreateContactThreadInput,
    actor: ContactActor,
  ) {
    const hotel = await this.db.hotel.findUnique({
      where: { id: hotelId },
      select: { id: true, name: true, managerId: true },
    });
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    if (dto.bookingId) {
      const booking = await this.db.booking.findFirst({
        where: { id: dto.bookingId, hotelId },
        select: { id: true, userId: true },
      });
      if (!booking) {
        throw new BadRequestException('Booking not found for this hotel');
      }
      if (actor.role === 'CUSTOMER' && booking.userId !== actor.sub) {
        throw new ForbiddenException('Booking does not belong to you');
      }
    }

    const thread = await this.db.contactThread.create({
      data: {
        customerId: actor.sub,
        hotelId,
        bookingId: dto.bookingId,
        subject: dto.subject,
        status: 'OPEN',
        messages: {
          create: {
            senderId: actor.sub,
            content: dto.message,
          },
        },
      },
      include: {
        customer: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        hotel: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    await this.audit.record(
      actor.sub,
      'CONTACT_THREAD_CREATED',
      'ContactThread',
      thread.id,
      {
        hotelId,
        subject: dto.subject,
      },
    );

    if (this.notifications && hotel.managerId) {
      try {
        await this.notifications.notify({
          userId: hotel.managerId,
          type: 'CONTACT_MESSAGE_RECEIVED',
          channel: NOTIFICATION_CHANNELS.IN_APP,
          payload: {
            title: 'New Guest Inquiry',
            message: `New message for ${hotel.name}: ${dto.subject}`,
            threadId: thread.id,
            hotelId,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch hotel contact notification: ${err}`);
      }
    }

    return thread;
  }

  async listThreads(actor: ContactActor, hotelId?: string) {
    const where: Prisma.ContactThreadWhereInput = {};

    if (actor.role === 'CUSTOMER') {
      where.customerId = actor.sub;
      if (hotelId) where.hotelId = hotelId;
    } else if (actor.role === 'MANAGER') {
      if (hotelId) {
        where.hotelId = hotelId;
        where.hotel = { managerId: actor.sub };
      } else {
        where.hotel = { managerId: actor.sub };
      }
    } else if (actor.role === 'STAFF') {
      if (hotelId) {
        where.hotelId = hotelId;
        where.hotel = { staffAssignments: { some: { staffId: actor.sub } } };
      } else {
        where.hotel = { staffAssignments: { some: { staffId: actor.sub } } };
      }
    } else if (actor.role === 'ADMIN') {
      if (hotelId) where.hotelId = hotelId;
    }

    return this.db.contactThread.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        customer: {
          select: { id: true, fullName: true, email: true },
        },
        hotel: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: actor.sub },
                readAt: null,
              },
            },
          },
        },
      },
    });
  }

  async getThread(threadId: string, actor: ContactActor) {
    const thread = await this.db.contactThread.findUnique({
      where: { id: threadId },
      include: {
        customer: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        hotel: {
          select: {
            id: true,
            name: true,
            managerId: true,
            staffAssignments: { select: { staffId: true } },
          },
        },
        booking: {
          select: {
            id: true,
            bookingRef: true,
            checkIn: true,
            checkOut: true,
            status: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, fullName: true, role: true },
            },
          },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException('Contact thread not found');
    }

    this.assertCanAccessThread(thread, actor);

    // Mark unread incoming messages as read
    await this.db.contactMessage.updateMany({
      where: {
        threadId,
        senderId: { not: actor.sub },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return thread;
  }

  async sendMessage(
    threadId: string,
    dto: SendContactMessageInput,
    actor: ContactActor,
  ) {
    const thread = await this.db.contactThread.findUnique({
      where: { id: threadId },
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            managerId: true,
            staffAssignments: { select: { staffId: true } },
          },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException('Contact thread not found');
    }

    this.assertCanAccessThread(thread, actor);

    const message = await this.db.contactMessage.create({
      data: {
        threadId,
        senderId: actor.sub,
        content: dto.content,
      },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
      },
    });

    await this.db.contactThread.update({
      where: { id: threadId },
      data: {
        status: 'OPEN',
        updatedAt: new Date(),
      },
    });

    await this.audit.record(
      actor.sub,
      'CONTACT_MESSAGE_SENT',
      'ContactThread',
      threadId,
      {
        messageId: message.id,
      },
    );

    // Notify the other party
    if (this.notifications) {
      try {
        if (actor.sub === thread.customerId) {
          // Notify hotel manager
          if (thread.hotel.managerId) {
            await this.notifications.notify({
              userId: thread.hotel.managerId,
              type: 'CONTACT_MESSAGE_RECEIVED',
              channel: NOTIFICATION_CHANNELS.IN_APP,
              payload: {
                title: 'New Message from Guest',
                message: dto.content.slice(0, 100),
                threadId,
              },
            });
          }
        } else {
          // Notify customer
          await this.notifications.notify({
            userId: thread.customerId,
            type: 'CONTACT_MESSAGE_RECEIVED',
            channel: NOTIFICATION_CHANNELS.IN_APP,
            payload: {
              title: `Response from ${thread.hotel.name}`,
              message: dto.content.slice(0, 100),
              threadId,
            },
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to dispatch message notification: ${err}`);
      }
    }

    return message;
  }

  async updateStatus(
    threadId: string,
    dto: UpdateContactStatusInput,
    actor: ContactActor,
  ) {
    const thread = await this.db.contactThread.findUnique({
      where: { id: threadId },
      include: {
        hotel: {
          select: {
            id: true,
            managerId: true,
            staffAssignments: { select: { staffId: true } },
          },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException('Contact thread not found');
    }

    this.assertCanAccessThread(thread, actor);

    const updated = await this.db.contactThread.update({
      where: { id: threadId },
      data: { status: dto.status },
    });

    await this.audit.record(
      actor.sub,
      'CONTACT_THREAD_STATUS_UPDATED',
      'ContactThread',
      threadId,
      { status: dto.status },
    );

    return updated;
  }

  private assertCanAccessThread(
    thread: {
      customerId: string;
      hotel: {
        managerId: string | null;
        staffAssignments?: { staffId: string }[];
      };
    },
    actor: ContactActor,
  ) {
    if (actor.role === 'ADMIN') return;
    if (actor.role === 'CUSTOMER') {
      if (thread.customerId !== actor.sub) {
        throw new ForbiddenException('Access to contact thread denied');
      }
      return;
    }
    if (actor.role === 'MANAGER') {
      if (thread.hotel.managerId !== actor.sub) {
        throw new ForbiddenException('Access to contact thread denied');
      }
      return;
    }
    if (actor.role === 'STAFF') {
      const isAssigned = thread.hotel.staffAssignments?.some(
        (s) => s.staffId === actor.sub,
      );
      if (!isAssigned) {
        throw new ForbiddenException('Access to contact thread denied');
      }
      return;
    }
    throw new ForbiddenException('Access to contact thread denied');
  }
}
