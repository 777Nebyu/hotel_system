import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { exporterFor } from '../infrastructure';
import type { ReportFormat, ReportRow } from '../infrastructure';
import type { ReportType } from '../domain';

const DASHBOARD_CACHE_TTL = 300; // 5 minutes

const REPORT_TITLES: Record<ReportType, string> = {
  booking: 'Booking Report',
  revenue: 'Revenue Report',
  occupancy: 'Occupancy Report',
  customer: 'Customer Report',
  cancellation: 'Cancellation Report',
};

@Injectable()
export class AdminReportingService {
  constructor(
    private readonly db: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async overview() {
    const key = 'admin:dashboard:overview';
    const cached = await this.cache.get<ReturnType<typeof this.computeOverview>>(key);
    if (cached) return cached;
    const result = await this.computeOverview();
    await this.cache.set(key, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  private async computeOverview() {
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
    const key = `admin:dashboard:monthly-revenue:${months}`;
    const cached = await this.cache.get<{ month: string; revenue: number }[]>(key);
    if (cached) return cached;
    const result = await this.computeMonthlyRevenue(months);
    await this.cache.set(key, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  private async computeMonthlyRevenue(months = 12) {
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
    const key = `admin:dashboard:booking-trends:${days}`;
    const cached = await this.cache.get<{ date: string; bookings: number }[]>(key);
    if (cached) return cached;
    const result = await this.computeBookingTrends(days);
    await this.cache.set(key, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  private async computeBookingTrends(days = 30) {
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
    const key = `admin:dashboard:most-booked-hotels:${limit}`;
    const cached = await this.cache.get<{ hotelId: string; name: string; bookings: number }[]>(key);
    if (cached) return cached;
    const result = await this.computeMostBookedHotels(limit);
    await this.cache.set(key, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  private async computeMostBookedHotels(limit = 10) {
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

  async exportReport(type: ReportType, format: ReportFormat) {
    const rows = await this.builder(type)();
    const exporter = exporterFor(format);
    const buffer = await exporter.export(REPORT_TITLES[type], rows);
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    return { buffer, fileName: `report-${type}.${ext}` };
  }

  private builder(type: ReportType): () => Promise<ReportRow[]> {
    switch (type) {
      case 'booking':
        return () => this.bookingRows();
      case 'revenue':
        return () => this.revenueRows();
      case 'occupancy':
        return () => this.occupancyRows();
      case 'customer':
        return () => this.customerRows();
      case 'cancellation':
        return () => this.cancellationRows();
    }
  }

  private async bookingRows(): Promise<ReportRow[]> {
    const bookings = await this.db.booking.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        hotel: { select: { name: true } },
        user: { select: { fullName: true, email: true } },
      },
    });
    return bookings.map((b) => ({
      id: b.id,
      hotel: b.hotel.name,
      customer: b.user.fullName,
      email: b.user.email,
      checkIn: b.checkIn.toISOString().slice(0, 10),
      checkOut: b.checkOut.toISOString().slice(0, 10),
      status: b.status,
      total: b.totalPrice.toNumber(),
    }));
  }

  private async revenueRows(): Promise<ReportRow[]> {
    const revenue = await this.revenueByHotel();
    return revenue.map((row) => ({ hotel: row.name, revenue: row.revenue }));
  }

  private async occupancyRows(): Promise<ReportRow[]> {
    const [hotels, activeBookings, rooms] = await Promise.all([
      this.db.hotel.findMany({ select: { id: true, name: true } }),
      this.db.booking.findMany({
        where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
        select: { checkIn: true, checkOut: true, hotelId: true },
      }),
      this.db.room.groupBy({ by: ['hotelId'], _count: { _all: true } }),
    ]);
    const now = new Date();
    const today = now.toDateString();
    const occupiedByHotel = new Map<string, number>();
    for (const booking of activeBookings) {
      let occupiedToday = false;
      for (
        let d = booking.checkIn.getTime();
        d < booking.checkOut.getTime();
        d += 86_400_000
      ) {
        if (new Date(d).toDateString() === today) {
          occupiedToday = true;
          break;
        }
      }
      if (occupiedToday) {
        occupiedByHotel.set(
          booking.hotelId,
          (occupiedByHotel.get(booking.hotelId) ?? 0) + 1,
        );
      }
    }
    const roomCounts = new Map(rooms.map((r) => [r.hotelId, r._count._all]));
    return hotels
      .map((hotel) => {
        const totalRooms = roomCounts.get(hotel.id) ?? 0;
        const occupied = occupiedByHotel.get(hotel.id) ?? 0;
        return {
          hotel: hotel.name,
          rooms: totalRooms,
          occupiedToday: occupied,
          occupancyRate:
            totalRooms > 0
              ? Math.round((occupied / totalRooms) * 1000) / 1000
              : 0,
        };
      })
      .filter((row) => row.rooms > 0);
  }

  private async customerRows(): Promise<ReportRow[]> {
    const customers = await this.db.user.findMany({
      where: { bookings: { some: {} } },
      include: {
        bookings: {
          select: { payment: { select: { status: true, amount: true } } },
        },
      },
    });
    return customers
      .map((user) => {
        const bookings = user.bookings.length;
        const spend = user.bookings.reduce(
          (sum, b) =>
            sum +
            (b.payment?.status === 'SUCCEEDED'
              ? b.payment.amount.toNumber()
              : 0),
          0,
        );
        return {
          id: user.id,
          customer: user.fullName,
          email: user.email,
          bookings,
          spend: Math.round(spend * 100) / 100,
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }

  private async cancellationRows(): Promise<ReportRow[]> {
    const bookings = await this.db.booking.findMany({
      where: { status: 'CANCELLED' },
      orderBy: { updatedAt: 'desc' },
      include: {
        hotel: { select: { name: true } },
        user: { select: { fullName: true, email: true } },
      },
    });
    return bookings.map((b) => ({
      id: b.id,
      hotel: b.hotel.name,
      customer: b.user.fullName,
      email: b.user.email,
      cancelledAt: b.updatedAt.toISOString().slice(0, 10),
      total: b.totalPrice.toNumber(),
    }));
  }
}
