import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminReportingService {
  constructor(private readonly db: PrismaService) {}

  async overview() {
    const [userCount, hotelCount, bookingCount, revenueAgg, bookingsByStatus] =
      await Promise.all([
        this.db.user.count(),
        this.db.hotel.count(),
        this.db.booking.count(),
        this.db.payment.aggregate({
          where: { status: 'SUCCEEDED' },
          _sum: { amount: true },
        }),
        this.db.booking.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
      ]);
    return {
      userCount,
      hotelCount,
      bookingCount,
      totalRevenue: revenueAgg._sum.amount?.toNumber() ?? 0,
      bookingsByStatus: Object.fromEntries(
        bookingsByStatus.map((row) => [row.status, row._count._all]),
      ),
    };
  }

  async revenueByHotel() {
    const payments = await this.db.payment.findMany({
      where: { status: 'SUCCEEDED' },
      include: {
        booking: {
          select: { hotel: { select: { id: true, name: true } } },
        },
      },
    });
    const byHotel = new Map<
      string,
      { hotelId: string; name: string; revenue: number }
    >();
    for (const payment of payments) {
      const hotel = payment.booking.hotel;
      const entry = byHotel.get(hotel.id) ?? {
        hotelId: hotel.id,
        name: hotel.name,
        revenue: 0,
      };
      entry.revenue += payment.amount.toNumber();
      byHotel.set(hotel.id, entry);
    }
    return Array.from(byHotel.values())
      .map((row) => ({ ...row, revenue: Math.round(row.revenue * 100) / 100 }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async occupancyRate() {
    const [rooms, activeBookings] = await Promise.all([
      this.db.room.count(),
      this.db.booking.findMany({
        where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
        select: { checkIn: true, checkOut: true, hotelId: true },
      }),
    ]);
    const now = new Date();
    const occupiedRoomNights = activeBookings.reduce((sum, booking) => {
      for (
        let d = booking.checkIn.getTime();
        d < booking.checkOut.getTime();
        d += 86_400_000
      ) {
        if (new Date(d).toDateString() === now.toDateString()) {
          sum += 1;
        }
      }
      return sum;
    }, 0);
    return {
      rooms,
      occupiedRoomsToday: occupiedRoomNights,
      occupancyRate:
        rooms > 0 ? Math.round((occupiedRoomNights / rooms) * 1000) / 1000 : 0,
    };
  }
}
