import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import type { ExportQueryInput } from '@repo/shared-types';

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const line = headers
      .map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',');
    lines.push(line);
  }
  return lines.join('\n');
}

@Injectable()
export class AdminExportService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async exportData(
    dto: ExportQueryInput,
    actor: { sub: string; role: string },
  ): Promise<{ filename: string; content: string }> {
    if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
      throw new ForbiddenException('Only admins and managers can export data');
    }

    let managedHotelIds: string[] | undefined;
    if (actor.role === 'MANAGER') {
      const hotels = await this.db.hotel.findMany({
        where: { managerId: actor.sub },
        select: { id: true },
      });
      managedHotelIds = hotels.map((h) => h.id);
      if (dto.type === 'users') {
        throw new ForbiddenException('Managers cannot export user directory data');
      }
    }

    let rows: Record<string, unknown>[] = [];
    const maxLimit = 10000;

    if (dto.type === 'bookings') {
      const where: Record<string, unknown> = {};
      if (managedHotelIds) {
        where.hotelId = { in: managedHotelIds };
      } else if (dto.hotelId) {
        where.hotelId = dto.hotelId;
      }
      if (dto.startDate || dto.endDate) {
        where.createdAt = {
          ...(dto.startDate ? { gte: new Date(dto.startDate) } : {}),
          ...(dto.endDate ? { lte: new Date(dto.endDate) } : {}),
        };
      }

      const count = await this.db.booking.count({ where });
      if (count > maxLimit) {
        throw new BadRequestException('Export exceeds 10,000 rows. Please apply more specific date filters.');
      }

      const bookings = await this.db.booking.findMany({
        where,
        take: maxLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: { select: { name: true } },
          user: { select: { fullName: true, email: true } },
        },
      });

      rows = bookings.map((b) => ({
        id: b.id,
        reference: b.bookingRef ?? '',
        hotel: b.hotel.name,
        customerName: b.user.fullName,
        customerEmail: b.user.email,
        status: b.status,
        checkIn: b.checkIn.toISOString().slice(0, 10),
        checkOut: b.checkOut.toISOString().slice(0, 10),
        totalPrice: b.totalPrice.toNumber(),
        bookingSource: b.bookingSource,
        createdAt: b.createdAt.toISOString(),
      }));
    } else if (dto.type === 'payments') {
      const where: Record<string, unknown> = {};
      if (managedHotelIds) {
        where.booking = { hotelId: { in: managedHotelIds } };
      }
      if (dto.startDate || dto.endDate) {
        where.createdAt = {
          ...(dto.startDate ? { gte: new Date(dto.startDate) } : {}),
          ...(dto.endDate ? { lte: new Date(dto.endDate) } : {}),
        };
      }

      const count = await this.db.payment.count({ where });
      if (count > maxLimit) {
        throw new BadRequestException('Export exceeds 10,000 rows. Please apply more specific date filters.');
      }

      const payments = await this.db.payment.findMany({
        where,
        take: maxLimit,
        orderBy: { createdAt: 'desc' },
      });

      rows = payments.map((p) => ({
        id: p.id,
        bookingId: p.bookingId,
        method: p.method,
        amount: p.amount.toNumber(),
        status: p.status,
        refundAmount: p.refundAmount?.toNumber() ?? 0,
        providerRef: p.providerRef ?? '',
        createdAt: p.createdAt.toISOString(),
      }));
    } else if (dto.type === 'reviews') {
      const where: Record<string, unknown> = {};
      if (managedHotelIds) {
        where.hotelId = { in: managedHotelIds };
      } else if (dto.hotelId) {
        where.hotelId = dto.hotelId;
      }

      const count = await this.db.review.count({ where });
      if (count > maxLimit) {
        throw new BadRequestException('Export exceeds 10,000 rows. Please apply filters.');
      }

      const reviews = await this.db.review.findMany({
        where,
        take: maxLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: { select: { name: true } },
          user: { select: { fullName: true } },
        },
      });

      rows = reviews.map((r) => ({
        id: r.id,
        hotel: r.hotel.name,
        reviewer: r.user.fullName,
        rating: r.rating,
        comment: r.comment ?? '',
        isVerifiedStay: r.bookingId !== null,
        createdAt: r.createdAt.toISOString(),
      }));
    } else if (dto.type === 'users') {
      const count = await this.db.user.count();
      if (count > maxLimit) {
        throw new BadRequestException('Export exceeds 10,000 rows. Please apply filters.');
      }

      const users = await this.db.user.findMany({
        take: maxLimit,
        orderBy: { createdAt: 'desc' },
      });

      rows = users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone ?? '',
        role: u.role,
        status: u.status,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
      }));
    }

    await this.audit.record(actor.sub, 'DATA_EXPORTED', 'Export', dto.type, {
      type: dto.type,
      rowsCount: rows.length,
    });

    const content = toCsv(rows);
    const filename = `export-${dto.type}-${Date.now()}.csv`;
    return { filename, content };
  }
}
