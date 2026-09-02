import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import type { AssignStaffInput, HotelStaffQuery } from '@repo/shared-types';

@Injectable()
export class AdminStaffService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listHotelStaff(hotelId: string, query: HotelStaffQuery) {
    await this.requireHotelExists(hotelId);
    const [total, staff] = await Promise.all([
      this.db.staffHotel.count({ where: { hotelId } }),
      this.db.staffHotel.findMany({
        where: { hotelId },
        orderBy: { assignedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          staff: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
        },
      }),
    ]);
    return { data: staff, total, page: query.page, pageSize: query.pageSize };
  }

  async assignStaff(hotelId: string, dto: AssignStaffInput, actorId: string) {
    await this.requireHotelExists(hotelId);
    const user = await this.db.user.findUnique({
      where: { id: dto.staffId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'STAFF') {
      throw new BadRequestException('User must have the STAFF role to be assigned');
    }
    try {
      const assignment = await this.db.staffHotel.create({
        data: { staffId: dto.staffId, hotelId },
        include: {
          staff: { select: { id: true, fullName: true, email: true } },
          hotel: { select: { id: true, name: true } },
        },
      });
      await this.audit.record(actorId, 'ASSIGN_STAFF', 'Hotel', hotelId, {
        staffId: dto.staffId,
      });
      return assignment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Staff member is already assigned to this hotel');
      }
      throw error;
    }
  }

  async removeStaff(hotelId: string, staffId: string, actorId: string) {
    await this.requireHotelExists(hotelId);
    try {
      await this.db.staffHotel.delete({
        where: { staffId_hotelId: { staffId, hotelId } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Staff assignment not found');
      }
      throw error;
    }
    await this.audit.record(actorId, 'REMOVE_STAFF', 'Hotel', hotelId, {
      staffId,
    });
    return { removed: true };
  }

  private async requireHotelExists(hotelId: string) {
    const hotel = await this.db.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
  }
}
