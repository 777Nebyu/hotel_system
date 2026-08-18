import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import type {
  AdminHotelsQuery,
  ReassignManager,
  UpdateHotelStatus,
} from '@repo/shared-types';

@Injectable()
export class AdminHotelService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminHotelsQuery) {
    const where: Prisma.HotelWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [{ name: { contains: query.search, mode: 'insensitive' } }];
    }
    const [total, hotels] = await Promise.all([
      this.db.hotel.count({ where }),
      this.db.hotel.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          manager: { select: { id: true, fullName: true, email: true } },
          city: { select: { id: true, name: true } },
          _count: { select: { rooms: true, bookings: true, reviews: true } },
        },
      }),
    ]);
    return { data: hotels, total, page: query.page, pageSize: query.pageSize };
  }

  async updateStatus(hotelId: string, dto: UpdateHotelStatus, actorId: string) {
    const before = await this.db.hotel.findUniqueOrThrow({
      where: { id: hotelId },
    });
    const updated = await this.db.hotel.update({
      where: { id: hotelId },
      data: { status: dto.status },
    });
    await this.audit.record(actorId, 'UPDATE_STATUS', 'Hotel', hotelId, {
      status: { from: before.status, to: dto.status },
    });
    return updated;
  }

  async reassignManager(
    hotelId: string,
    dto: ReassignManager,
    actorId: string,
  ) {
    if (dto.managerId) {
      const manager = await this.db.user.findUnique({
        where: { id: dto.managerId },
        select: { id: true },
      });
      if (!manager) throw new NotFoundException('Manager not found');
    }
    const before = await this.db.hotel.findUniqueOrThrow({
      where: { id: hotelId },
    });
    const updated = await this.db.hotel.update({
      where: { id: hotelId },
      data: { managerId: dto.managerId },
    });
    await this.audit.record(actorId, 'REASSIGN_MANAGER', 'Hotel', hotelId, {
      managerId: { from: before.managerId, to: dto.managerId },
    });
    return updated;
  }
}
