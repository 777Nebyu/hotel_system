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

  async monthlyRevenue(months = 12) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(1);
    start.setMonth(start.getMonth() - (months - 1));

    const payments = await this.db.payment.findMany({
      where: { status: 'SUCCEEDED', createdAt: { gte: start } },
      select: { amount: true, createdAt: true },
    });
    const byMonth = new Map<string, number>();
    for (const payment of payments) {
      const key = `${payment.createdAt.getFullYear()}-${String(
        payment.createdAt.getMonth() + 1,
      ).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + payment.amount.toNumber());
    }

    const series: { month: string; revenue: number }[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < months; i++) {
      const key = `${cursor.getFullYear()}-${String(
        cursor.getMonth() + 1,
      ).padStart(2, '0')}`;
      series.push({
        month: key,
        revenue: Math.round((byMonth.get(key) ?? 0) * 100) / 100,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return series;
  }

  async bookingTrends(days = 30) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const bookings = await this.db.booking.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    });
    const byDay = new Map<string, number>();
    for (const booking of bookings) {
      const key = `${booking.createdAt.getFullYear()}-${String(
        booking.createdAt.getMonth() + 1,
      ).padStart(
        2,
        '0',
      )}-${String(booking.createdAt.getDate()).padStart(2, '0')}`;
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    const series: { date: string; bookings: number }[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < days; i++) {
      const key = `${cursor.getFullYear()}-${String(
        cursor.getMonth() + 1,
      ).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      series.push({ date: key, bookings: byDay.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return series;
  }

  async mostBookedHotels(limit = 10) {
    const grouped = await this.db.booking.groupBy({
      by: ['hotelId'],
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    if (grouped.length === 0) return [];
    const hotels = await this.db.hotel.findMany({
      where: { id: { in: grouped.map((row) => row.hotelId) } },
      select: { id: true, name: true },
    });
    const names = new Map(hotels.map((hotel) => [hotel.id, hotel.name]));
    return grouped.map((row) => ({
      hotelId: row.hotelId,
      name: names.get(row.hotelId) ?? 'Unknown',
      bookings: row._count._all,
    }));
  }
}
