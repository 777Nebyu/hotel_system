import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DisputeStatus, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { FraudService } from '../../fraud/application/fraud.service';
import type {
  CreateDisputeInput,
  DisputeQuery,
  ResolveDisputeInput,
} from '@repo/shared-types';

@Injectable()
export class DisputeService {
  constructor(
    private readonly db: PrismaService,
    @Optional()
    private readonly fraud?: FraudService,
  ) {}

  async create(dto: CreateDisputeInput, userId: string) {
    const booking = await this.db.booking.findUnique({
      where: { id: dto.bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only dispute your own bookings');
    }
    const dispute = await this.db.dispute.create({
      data: {
        bookingId: dto.bookingId,
        openedById: userId,
        reason: dto.reason,
      },
      include: {
        booking: { select: { id: true, bookingRef: true } },
        openedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (this.fraud) {
      void this.fraud.checkDisputeVelocity(userId);
    }

    return dispute;
  }

  async listForUser(userId: string, query: DisputeQuery) {
    const where: Prisma.DisputeWhereInput = { openedById: userId };
    if (query.status) where.status = query.status as DisputeStatus;
    const [total, disputes] = await Promise.all([
      this.db.dispute.count({ where }),
      this.db.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          booking: { select: { id: true, bookingRef: true } },
        },
      }),
    ]);
    return { data: disputes, total, page: query.page, pageSize: query.pageSize };
  }

  async adminList(query: DisputeQuery) {
    const where: Prisma.DisputeWhereInput = {};
    if (query.status) where.status = query.status as DisputeStatus;
    const [total, disputes] = await Promise.all([
      this.db.dispute.count({ where }),
      this.db.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          booking: { select: { id: true, bookingRef: true, hotelId: true } },
          openedBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);
    return { data: disputes, total, page: query.page, pageSize: query.pageSize };
  }

  async markUnderReview(id: string) {
    return this.updateStatus(id, DisputeStatus.UNDER_REVIEW);
  }

  async resolve(id: string, dto: ResolveDisputeInput) {
    return this.db.dispute.update({
      where: { id },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution: dto.resolution,
        resolvedAt: new Date(),
      },
    });
  }

  async close(id: string) {
    return this.updateStatus(id, DisputeStatus.CLOSED);
  }

  private async updateStatus(id: string, status: DisputeStatus) {
    try {
      return await this.db.dispute.update({ where: { id }, data: { status } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Dispute not found');
      }
      throw error;
    }
  }
}
