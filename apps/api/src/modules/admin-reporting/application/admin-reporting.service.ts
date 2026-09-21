import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { exporterFor } from '../infrastructure';
import type {
  ReportFormat,
  ReportRow,
  ReportDocument,
  ReportKpiCard,
  ReportSection,
} from '../infrastructure';
import type { ReportType } from '../domain';

const DASHBOARD_CACHE_TTL = 300; // 5 minutes

const REPORT_TITLES: Record<ReportType, string> = {
  overview: 'Executive Performance Overview',
  booking: 'Reservations & Bookings Report',
  revenue: 'Financial Revenue Report',
  occupancy: 'Property Occupancy Report',
  customer: 'Guest Demographics & Spending Report',
  cancellation: 'Cancellations & Lost Revenue Report',
};

const formatETB = (amount: number | string | null | undefined): string => {
  const num = typeof amount === 'number' ? amount : Number(amount ?? 0);
  return `ETB ${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

@Injectable()
export class AdminReportingService {
  constructor(
    private readonly db: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Admin Dashboard Metrics (JSON APIs) ──────────────────────────────────

  async overview() {
    const key = 'admin:dashboard:overview';
    const cached = await this.cache.get<ReturnType<typeof this.computeOverview>>(key);
    if (cached) return cached;
    const result = await this.computeOverview();
    await this.cache.set(key, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  private async computeOverview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      userCount,
      customerCount,
      staffCount,
      hotelCount,
      activeHotels,
      pendingHotels,
      bookingCount,
      activeBookings,
      pendingBookings,
      revenueAgg,
      monthRevenueAgg,
      pendingPayments,
      pendingDisputes,
      flaggedReviewCount,
      bookingsByStatus,
      topHotels,
      recentActivity,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({ where: { role: 'CUSTOMER' } }),
      this.db.user.count({ where: { role: { in: ['STAFF', 'MANAGER'] } } }),

      this.db.hotel.count(),
      this.db.hotel.count({ where: { status: 'ACTIVE' } }),
      this.db.hotel.count({ where: { status: 'PENDING_APPROVAL' } }),

      this.db.booking.count(),
      this.db.booking.count({
        where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
      }),
      this.db.booking.count({ where: { status: 'PENDING' } }),

      this.db.payment.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amount: true },
      }),
      this.db.payment.aggregate({
        where: { status: 'SUCCEEDED', createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),

      this.db.payment.count({ where: { status: 'PENDING' } }),
      this.db.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
      this.db.review.count({
        where: { user: { isFlagged: true } },
      }),

      this.db.booking.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      this.db.payment.findMany({
        where: { status: 'SUCCEEDED' },
        select: {
          amount: true,
          booking: {
            select: {
              hotel: { select: { id: true, name: true, starRating: true } },
            },
          },
        },
      }),

      this.db.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          createdAt: true,
          actor: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    const revenueByHotelMap = new Map<
      string,
      { id: string; name: string; starRating: number; revenue: number }
    >();
    for (const payment of topHotels) {
      const hotel = payment.booking?.hotel;
      if (!hotel) continue;
      const entry = revenueByHotelMap.get(hotel.id) ?? {
        id: hotel.id,
        name: hotel.name,
        starRating: hotel.starRating,
        revenue: 0,
      };
      entry.revenue += payment.amount.toNumber();
      revenueByHotelMap.set(hotel.id, entry);
    }
    const topHotelsList = Array.from(revenueByHotelMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const statusCounts: Record<string, number> = {};
    for (const row of bookingsByStatus) {
      statusCounts[row.status] = row._count._all;
    }

    const totalRev = revenueAgg._sum.amount?.toNumber() ?? 0;

    return {
      userCount,
      hotelCount,
      bookingCount,
      totalRevenue: totalRev,
      users: {
        total: userCount,
        customers: customerCount,
        staff: staffCount,
      },
      hotels: {
        total: hotelCount,
        active: activeHotels,
        pending: pendingHotels,
      },
      bookings: {
        total: bookingCount,
        active: activeBookings,
        pending: pendingBookings,
        byStatus: statusCounts,
      },
      revenue: {
        total: totalRev,
        thisMonth: monthRevenueAgg._sum.amount?.toNumber() ?? 0,
        pendingPayments,
      },
      disputes: {
        open: pendingDisputes,
      },
      moderation: {
        flaggedReviews: flaggedReviewCount,
      },
      topHotels: topHotelsList,
      recentActivity,
    };
  }

  async revenueByHotel() {
    const payments = await this.db.payment.findMany({
      where: { status: 'SUCCEEDED' },
      select: {
        amount: true,
        booking: {
          select: {
            hotel: { select: { id: true, name: true } },
          },
        },
      },
    });

    const byHotel = new Map<string, { id: string; name: string; revenue: number }>();
    for (const payment of payments) {
      const hotel = payment.booking?.hotel;
      if (!hotel) continue;
      const entry = byHotel.get(hotel.id) ?? {
        id: hotel.id,
        name: hotel.name,
        revenue: 0,
      };
      entry.revenue += payment.amount.toNumber();
      byHotel.set(hotel.id, entry);
    }
    return Array.from(byHotel.values()).sort((a, b) => b.revenue - a.revenue);
  }

  async occupancyRate() {
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
    let totalRoomsAll = 0;
    let totalOccupiedAll = 0;

    const breakdown = hotels
      .map((hotel) => {
        const totalRooms = roomCounts.get(hotel.id) ?? 0;
        const occupied = occupiedByHotel.get(hotel.id) ?? 0;
        totalRoomsAll += totalRooms;
        totalOccupiedAll += occupied;
        return {
          hotelId: hotel.id,
          name: hotel.name,
          totalRooms,
          occupiedToday: occupied,
          occupancyRate:
            totalRooms > 0
              ? Math.round((occupied / totalRooms) * 1000) / 1000
              : 0,
        };
      })
      .filter((h) => h.totalRooms > 0);

    const calculatedRate =
      totalRoomsAll > 0
        ? Math.round((totalOccupiedAll / totalRoomsAll) * 1000) / 1000
        : 0;

    return {
      rooms: totalRoomsAll,
      occupiedRoomsToday: totalOccupiedAll,
      totalRooms: totalRoomsAll,
      occupiedToday: totalOccupiedAll,
      occupancyRate: calculatedRate,
      breakdown,
    };
  }

  async monthlyRevenue(months = 12) {
    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() - (months - 1));
    start.setHours(0, 0, 0, 0);

    const payments = await this.db.payment.findMany({
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: start },
      },
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
      series.push({ month: key, revenue: byMonth.get(key) ?? 0 });
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
      ).padStart(2, '0')}-${String(booking.createdAt.getDate()).padStart(2, '0')}`;
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

  // ── Date Range Calculation Helper ────────────────────────────────────────

  private getDateRangeForPeriod(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    customStart?: string,
    customEnd?: string,
  ): { start: Date; end: Date; label: string; dateRangeStr: string } {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);

    if (customStart && customEnd) {
      const parsedStart = new Date(customStart);
      const parsedEnd = new Date(customEnd);
      parsedEnd.setHours(23, 59, 59, 999);
      return {
        start: parsedStart,
        end: parsedEnd,
        label: 'Custom Range',
        dateRangeStr: `${parsedStart.toISOString().slice(0, 10)} to ${parsedEnd.toISOString().slice(0, 10)}`,
      };
    }

    switch (period) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start.setDate(now.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      case 'yearly':
        start.setDate(now.getDate() - 365);
        start.setHours(0, 0, 0, 0);
        break;
    }

    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly',
    };

    return {
      start,
      end,
      label: labels[period] || 'Monthly',
      dateRangeStr: `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
    };
  }

  // ── Export Report: Platform Administrator ────────────────────────────────

  async exportReport(
    type: ReportType,
    format: ReportFormat,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    startDate?: string,
    endDate?: string,
  ) {
    const { start, end, label: periodLabel, dateRangeStr } =
      this.getDateRangeForPeriod(period, startDate, endDate);

    const doc: ReportDocument = await this.buildAdminReportDocument(
      type,
      start,
      end,
      periodLabel,
      dateRangeStr,
    );

    const exporter = exporterFor(format);
    const buffer = await exporter.export(doc);
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    return {
      buffer,
      fileName: `luxstay-admin-${type}-${period}-${new Date().toISOString().slice(0, 10)}.${ext}`,
    };
  }

  private async buildAdminReportDocument(
    type: ReportType,
    start: Date,
    end: Date,
    periodLabel: string,
    dateRangeStr: string,
  ): Promise<ReportDocument> {
    const title = REPORT_TITLES[type] || 'Platform Management Report';
    const scopeName = 'All Properties (Platform Wide)';
    const generatedAt = new Date().toLocaleString();

    switch (type) {
      case 'overview': {
        const [bookings, succeededPayments, hotels, activeRooms] =
          await Promise.all([
            this.db.booking.findMany({
              where: { createdAt: { gte: start, lte: end } },
              include: {
                hotel: { select: { name: true, city: { select: { name: true } } } },
                user: { select: { fullName: true, email: true } },
                details: { include: { room: true } },
                payment: { select: { status: true, amount: true } },
              },
              orderBy: { createdAt: 'desc' },
            }),
            this.db.payment.aggregate({
              where: { status: 'SUCCEEDED', createdAt: { gte: start, lte: end } },
              _sum: { amount: true },
              _count: true,
            }),
            this.db.hotel.findMany({
              where: { status: 'ACTIVE' },
              select: { id: true, name: true, city: { select: { name: true } }, starRating: true },
            }),
            this.db.room.count(),
          ]);

        const totalRevenue = succeededPayments._sum.amount?.toNumber() ?? 0;
        const totalBookings = bookings.length;
        const confirmedBookings = bookings.filter(
          (b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT',
        ).length;
        const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED').length;

        const kpiCards: ReportKpiCard[] = [
          {
            label: 'Total Revenue',
            value: formatETB(totalRevenue),
            subtext: `${succeededPayments._count} transactions`,
          },
          {
            label: 'Total Bookings',
            value: totalBookings,
            subtext: `${confirmedBookings} confirmed / completed`,
          },
          {
            label: 'Cancellations',
            value: cancelledBookings,
            subtext: totalBookings > 0 ? `${((cancelledBookings / totalBookings) * 100).toFixed(1)}% rate` : '0%',
          },
          {
            label: 'Active Inventory',
            value: `${hotels.length} Hotels`,
            subtext: `${activeRooms} active rooms`,
          },
        ];

        // Hotel breakdown section
        const hotelStatsMap = new Map<
          string,
          { hotel: string; city: string; stars: number; bookings: number; revenue: number }
        >();
        for (const h of hotels) {
          hotelStatsMap.set(h.id, {
            hotel: h.name,
            city: h.city?.name ?? '—',
            stars: h.starRating,
            bookings: 0,
            revenue: 0,
          });
        }
        for (const b of bookings) {
          const entry = hotelStatsMap.get(b.hotelId);
          if (entry) {
            entry.bookings += 1;
            if (b.payment?.status === 'SUCCEEDED') {
              entry.revenue += b.payment.amount.toNumber();
            }
          }
        }
        const propertyRows: ReportRow[] = Array.from(hotelStatsMap.values())
          .sort((a, b) => b.revenue - a.revenue)
          .map((row) => ({
            hotel: row.hotel,
            location: row.city,
            starRating: `${row.stars} Stars`,
            bookings: row.bookings,
            revenue: formatETB(row.revenue),
          }));

        // Detailed bookings manifest
        const bookingRows: ReportRow[] = bookings.slice(0, 100).map((b) => ({
          bookingRef: b.bookingRef,
          hotel: b.hotel.name,
          guest: b.user.fullName,
          email: b.user.email,
          checkIn: b.checkIn.toISOString().slice(0, 10),
          checkOut: b.checkOut.toISOString().slice(0, 10),
          status: b.status,
          totalPrice: formatETB(b.totalPrice.toNumber()),
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [
            {
              title: 'Property Performance Breakdown',
              description: 'Operational and financial breakdown by property during this timeframe.',
              rows: propertyRows,
            },
            {
              title: 'Reservations Manifest',
              description: 'Latest guest reservations processed in this period.',
              rows: bookingRows,
            },
          ],
        };
      }

      case 'booking': {
        const bookings = await this.db.booking.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: {
            hotel: { select: { name: true } },
            user: { select: { fullName: true, email: true, phone: true } },
            details: { include: { room: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const total = bookings.length;
        const confirmed = bookings.filter(
          (b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT',
        ).length;
        const cancelled = bookings.filter((b) => b.status === 'CANCELLED').length;
        const grossValue = bookings.reduce((sum, b) => sum + b.totalPrice.toNumber(), 0);

        const kpiCards: ReportKpiCard[] = [
          { label: 'Total Reservations', value: total },
          { label: 'Confirmed / Active', value: confirmed },
          { label: 'Cancelled', value: cancelled },
          { label: 'Gross Booked Value', value: formatETB(grossValue) },
        ];

        const rows: ReportRow[] = bookings.map((b) => ({
          bookingRef: b.bookingRef,
          hotel: b.hotel.name,
          guest: b.user.fullName,
          phone: b.user.phone || '—',
          roomType: b.details?.[0]?.room?.type || 'Standard',
          checkIn: b.checkIn.toISOString().slice(0, 10),
          checkOut: b.checkOut.toISOString().slice(0, 10),
          status: b.status,
          total: formatETB(b.totalPrice.toNumber()),
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [{ title: 'Bookings Manifest', rows }],
        };
      }

      case 'revenue': {
        const payments = await this.db.payment.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: {
            booking: {
              include: {
                hotel: { select: { name: true } },
                user: { select: { fullName: true, email: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        const succeeded = payments.filter((p) => p.status === 'SUCCEEDED');
        const grossRevenue = succeeded.reduce((sum, p) => sum + p.amount.toNumber(), 0);
        const pendingCount = payments.filter((p) => p.status === 'PENDING').length;
        const failedCount = payments.filter((p) => p.status === 'FAILED').length;

        const kpiCards: ReportKpiCard[] = [
          { label: 'Gross Revenue', value: formatETB(grossRevenue) },
          { label: 'Paid Transactions', value: succeeded.length },
          { label: 'Pending Payments', value: pendingCount },
          { label: 'Failed Payments', value: failedCount },
        ];

        // Revenue by hotel
        const byHotel = new Map<string, { hotel: string; count: number; total: number }>();
        for (const p of succeeded) {
          const hName = p.booking?.hotel?.name || 'General';
          const item = byHotel.get(hName) ?? { hotel: hName, count: 0, total: 0 };
          item.count += 1;
          item.total += p.amount.toNumber();
          byHotel.set(hName, item);
        }
        const hotelRows: ReportRow[] = Array.from(byHotel.values())
          .sort((a, b) => b.total - a.total)
          .map((r) => ({
            hotel: r.hotel,
            paidTransactions: r.count,
            totalRevenue: formatETB(r.total),
          }));

        // Ledger
        const ledgerRows: ReportRow[] = payments.slice(0, 150).map((p) => ({
          transactionRef: p.providerRef || p.id.slice(-10),
          hotel: p.booking?.hotel?.name || '—',
          guest: p.booking?.user?.fullName || '—',
          date: p.createdAt.toISOString().slice(0, 10),
          provider: p.provider,
          status: p.status,
          amount: formatETB(p.amount.toNumber()),
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [
            { title: 'Revenue by Hotel Property', rows: hotelRows },
            { title: 'Payment Ledger', rows: ledgerRows },
          ],
        };
      }

      case 'occupancy': {
        const occ = await this.occupancyRate();
        const kpiCards: ReportKpiCard[] = [
          { label: 'Total Rooms', value: occ.totalRooms },
          { label: 'Occupied Today', value: occ.occupiedToday },
          { label: 'Occupancy Rate', value: `${(occ.occupancyRate * 100).toFixed(1)}%` },
        ];

        const rows: ReportRow[] = occ.breakdown.map((b) => ({
          hotel: b.name,
          totalRooms: b.totalRooms,
          occupiedToday: b.occupiedToday,
          occupancyRate: `${(b.occupancyRate * 100).toFixed(1)}%`,
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [{ title: 'Property Occupancy Analysis', rows }],
        };
      }

      case 'cancellation': {
        const cancelled = await this.db.booking.findMany({
          where: { status: 'CANCELLED', updatedAt: { gte: start, lte: end } },
          include: {
            hotel: { select: { name: true } },
            user: { select: { fullName: true, email: true } },
          },
          orderBy: { updatedAt: 'desc' },
        });

        const lostValue = cancelled.reduce((s, b) => s + b.totalPrice.toNumber(), 0);
        const kpiCards: ReportKpiCard[] = [
          { label: 'Total Cancellations', value: cancelled.length },
          { label: 'Lost Revenue', value: formatETB(lostValue) },
        ];

        const rows: ReportRow[] = cancelled.map((b) => ({
          bookingRef: b.bookingRef,
          hotel: b.hotel.name,
          guest: b.user.fullName,
          cancelledDate: b.updatedAt.toISOString().slice(0, 10),
          scheduledCheckIn: b.checkIn.toISOString().slice(0, 10),
          lostAmount: formatETB(b.totalPrice.toNumber()),
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [{ title: 'Cancellation Ledger', rows }],
        };
      }

      case 'customer': {
        const customers = await this.db.user.findMany({
          where: { bookings: { some: { createdAt: { gte: start, lte: end } } } },
          include: {
            bookings: {
              where: { createdAt: { gte: start, lte: end } },
              select: { payment: { select: { status: true, amount: true } } },
            },
          },
        });

        const customerEntries = customers.map((user) => {
          const bookingsCount = user.bookings.length;
          const spend = user.bookings.reduce(
            (sum, b) => sum + (b.payment?.status === 'SUCCEEDED' ? b.payment.amount.toNumber() : 0),
            0,
          );
          return {
            customer: user.fullName,
            email: user.email,
            phone: user.phone || '—',
            bookings: bookingsCount,
            spend,
          };
        }).sort((a, b) => b.spend - a.spend);

        const totalSpend = customerEntries.reduce((s, c) => s + c.spend, 0);
        const kpiCards: ReportKpiCard[] = [
          { label: 'Active Guests', value: customerEntries.length },
          { label: 'Total Spend', value: formatETB(totalSpend) },
          {
            label: 'Avg Spend / Guest',
            value: customerEntries.length > 0 ? formatETB(totalSpend / customerEntries.length) : '—',
          },
        ];

        const rows: ReportRow[] = customerEntries.map((c) => ({
          customer: c.customer,
          email: c.email,
          phone: c.phone,
          bookings: c.bookings,
          totalSpend: formatETB(c.spend),
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [{ title: 'Guest Spend Ranking', rows }],
        };
      }
    }
  }

  // ── Hotel Manager Specific Operations & Reports ──────────────────────────

  async hotelOverview(hotelId: string) {
    const key = `manager:dashboard:overview:${hotelId}`;
    const cached = await this.cache.get<any>(key);
    if (cached) return cached;

    const [
      hotel,
      activeBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      revenueAgg,
      availableRooms,
      occupiedBookingsToday,
    ] = await Promise.all([
      this.db.hotel.findUnique({
        where: { id: hotelId },
        include: {
          _count: { select: { rooms: true, bookings: true, reviews: true } },
        },
      }),
      this.db.booking.count({
        where: { hotelId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
      }),
      this.db.booking.count({
        where: { hotelId, status: 'PENDING' },
      }),
      this.db.booking.count({
        where: { hotelId, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
      }),
      this.db.booking.count({
        where: { hotelId, status: 'CANCELLED' },
      }),
      this.db.payment.aggregate({
        where: { booking: { hotelId }, status: 'SUCCEEDED' },
        _sum: { amount: true },
      }),
      this.db.room.count({
        where: { hotelId, status: 'AVAILABLE' },
      }),
      this.db.booking.findMany({
        where: { hotelId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
        select: { checkIn: true, checkOut: true },
      }),
    ]);

    if (!hotel) throw new NotFoundException('Hotel not found');

    const totalRooms = hotel._count.rooms;
    const now = new Date();
    const today = now.toDateString();
    let occupiedToday = 0;
    for (const b of occupiedBookingsToday) {
      for (let d = b.checkIn.getTime(); d < b.checkOut.getTime(); d += 86_400_000) {
        if (new Date(d).toDateString() === today) {
          occupiedToday++;
          break;
        }
      }
    }

    const occupancyRate =
      totalRooms > 0
        ? Math.round((occupiedToday / totalRooms) * 1000) / 1000
        : 0;

    const result = {
      hotel: {
        id: hotel.id,
        name: hotel.name,
        starRating: hotel.starRating,
        status: hotel.status,
      },
      roomsCount: totalRooms,
      totalRooms,
      activeRooms: totalRooms,
      availableRooms,
      totalBookings: hotel._count.bookings,
      activeBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      totalRevenue: revenueAgg._sum.amount?.toNumber() ?? 0,
      occupiedToday,
      occupiedRoomsToday: occupiedToday,
      occupancyRate,
    };

    await this.cache.set(key, result, DASHBOARD_CACHE_TTL);
    return result;
  }

  async hotelOccupancyRate(hotelId: string) {
    const [totalRooms, activeBookings] = await Promise.all([
      this.db.room.count({ where: { hotelId } }),
      this.db.booking.findMany({
        where: {
          hotelId,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        },
        select: { checkIn: true, checkOut: true },
      }),
    ]);

    const now = new Date();
    const today = now.toDateString();
    let occupiedToday = 0;

    for (const booking of activeBookings) {
      for (
        let d = booking.checkIn.getTime();
        d < booking.checkOut.getTime();
        d += 86_400_000
      ) {
        if (new Date(d).toDateString() === today) {
          occupiedToday++;
          break;
        }
      }
    }

    return {
      hotelId,
      totalRooms,
      rooms: totalRooms,
      occupiedToday,
      occupiedRoomsToday: occupiedToday,
      occupancyRate:
        totalRooms > 0
          ? Math.round((occupiedToday / totalRooms) * 1000) / 1000
          : 0,
    };
  }

  async hotelMonthlyRevenue(hotelId: string, months = 6) {
    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() - (months - 1));
    start.setHours(0, 0, 0, 0);

    const payments = await this.db.payment.findMany({
      where: {
        booking: { hotelId },
        status: 'SUCCEEDED',
        createdAt: { gte: start },
      },
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
      series.push({ month: key, revenue: byMonth.get(key) ?? 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return series;
  }

  async hotelBookingTrends(hotelId: string, days = 14) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const bookings = await this.db.booking.findMany({
      where: {
        hotelId,
        createdAt: { gte: start },
      },
      select: { createdAt: true },
    });

    const byDay = new Map<string, number>();
    for (const booking of bookings) {
      const key = `${booking.createdAt.getFullYear()}-${String(
        booking.createdAt.getMonth() + 1,
      ).padStart(2, '0')}-${String(booking.createdAt.getDate()).padStart(2, '0')}`;
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

  // ── Export Report: Hotel General Manager ─────────────────────────────────

  async exportHotelReport(
    hotelId: string,
    type: ReportType,
    format: ReportFormat,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    startDate?: string,
    endDate?: string,
  ) {
    const hotel = await this.db.hotel.findUnique({
      where: { id: hotelId },
      include: {
        city: { select: { name: true } },
        rooms: true,
      },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const { start, end, label: periodLabel, dateRangeStr } =
      this.getDateRangeForPeriod(period, startDate, endDate);

    const doc: ReportDocument = await this.buildHotelReportDocument(
      hotel,
      type,
      start,
      end,
      periodLabel,
      dateRangeStr,
    );

    const exporter = exporterFor(format);
    const buffer = await exporter.export(doc);
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    return {
      buffer,
      fileName: `hotel-${hotel.id}-${type}-${period}-${new Date().toISOString().slice(0, 10)}.${ext}`,
    };
  }

  private async buildHotelReportDocument(
    hotel: { id: string; name: string; city?: { name: string } | null; rooms: Array<{ id: string; type: string; roomNumber: string; basePrice: any }> },
    type: ReportType,
    start: Date,
    end: Date,
    periodLabel: string,
    dateRangeStr: string,
  ): Promise<ReportDocument> {
    const title = `${REPORT_TITLES[type] || 'Hotel Management Report'}`;
    const scopeName = hotel.name;
    const generatedAt = new Date().toLocaleString();

    switch (type) {
      case 'overview': {
        const [bookings, succeededPayments] = await Promise.all([
          this.db.booking.findMany({
            where: { hotelId: hotel.id, createdAt: { gte: start, lte: end } },
            include: {
              user: { select: { fullName: true, email: true, phone: true } },
              details: { include: { room: true } },
              payment: { select: { status: true, amount: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
          this.db.payment.aggregate({
            where: {
              booking: { hotelId: hotel.id },
              status: 'SUCCEEDED',
              createdAt: { gte: start, lte: end },
            },
            _sum: { amount: true },
            _count: true,
          }),
        ]);

        const totalRevenue = succeededPayments._sum.amount?.toNumber() ?? 0;
        const totalBookings = bookings.length;
        const confirmedBookings = bookings.filter(
          (b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT',
        ).length;
        const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED').length;

        const kpiCards: ReportKpiCard[] = [
          {
            label: 'Property Revenue',
            value: formatETB(totalRevenue),
            subtext: `${succeededPayments._count} completed transactions`,
          },
          {
            label: 'Total Bookings',
            value: totalBookings,
            subtext: `${confirmedBookings} confirmed / completed`,
          },
          {
            label: 'Cancellations',
            value: cancelledBookings,
            subtext: totalBookings > 0 ? `${((cancelledBookings / totalBookings) * 100).toFixed(1)}% rate` : '0%',
          },
          {
            label: 'Total Rooms',
            value: `${hotel.rooms.length} Units`,
            subtext: 'Property operational inventory',
          },
        ];

        // Room category summary
        const roomTypeMap = new Map<string, { type: string; inventory: number; bookedCount: number; revenue: number }>();
        for (const room of hotel.rooms) {
          const entry = roomTypeMap.get(room.type) ?? { type: room.type, inventory: 0, bookedCount: 0, revenue: 0 };
          entry.inventory += 1;
          roomTypeMap.set(room.type, entry);
        }
        for (const b of bookings) {
          const rType = b.details?.[0]?.room?.type;
          if (rType && roomTypeMap.has(rType)) {
            const entry = roomTypeMap.get(rType)!;
            entry.bookedCount += 1;
            if (b.payment?.status === 'SUCCEEDED') {
              entry.revenue += b.payment.amount.toNumber();
            }
          }
        }
        const roomRows: ReportRow[] = Array.from(roomTypeMap.values()).map((r) => ({
          roomType: r.type,
          inventoryUnits: r.inventory,
          reservationsCount: r.bookedCount,
          revenueGenerated: formatETB(r.revenue),
        }));

        // Reservations manifest
        const manifestRows: ReportRow[] = bookings.slice(0, 100).map((b) => ({
          bookingRef: b.bookingRef,
          guest: b.user.fullName,
          phone: b.user.phone || '—',
          room: b.details?.[0]?.room?.roomNumber ? `Rm ${b.details[0].room.roomNumber} (${b.details[0].room.type})` : 'Assigned at Check-in',
          checkIn: b.checkIn.toISOString().slice(0, 10),
          checkOut: b.checkOut.toISOString().slice(0, 10),
          status: b.status,
          totalPrice: formatETB(b.totalPrice.toNumber()),
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [
            {
              title: 'Room Category Performance',
              description: 'Room inventory performance and distribution during this period.',
              rows: roomRows,
            },
            {
              title: 'Guest Reservations Manifest',
              description: 'Reservations logged for this property.',
              rows: manifestRows,
            },
          ],
        };
      }

      case 'booking': {
        const bookings = await this.db.booking.findMany({
          where: { hotelId: hotel.id, createdAt: { gte: start, lte: end } },
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
            details: { include: { room: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const total = bookings.length;
        const confirmed = bookings.filter(
          (b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT',
        ).length;
        const cancelled = bookings.filter((b) => b.status === 'CANCELLED').length;
        const grossValue = bookings.reduce((sum, b) => sum + b.totalPrice.toNumber(), 0);

        const kpiCards: ReportKpiCard[] = [
          { label: 'Total Bookings', value: total },
          { label: 'Confirmed / Active', value: confirmed },
          { label: 'Cancelled', value: cancelled },
          { label: 'Gross Value', value: formatETB(grossValue) },
        ];

        const rows: ReportRow[] = bookings.map((b) => ({
          bookingRef: b.bookingRef,
          guest: b.user.fullName,
          phone: b.user.phone || '—',
          roomType: b.details?.[0]?.room?.type || 'Standard',
          checkIn: b.checkIn.toISOString().slice(0, 10),
          checkOut: b.checkOut.toISOString().slice(0, 10),
          status: b.status,
          total: formatETB(b.totalPrice.toNumber()),
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [{ title: 'Property Bookings Manifest', rows }],
        };
      }

      case 'revenue': {
        const payments = await this.db.payment.findMany({
          where: { booking: { hotelId: hotel.id }, createdAt: { gte: start, lte: end } },
          include: {
            booking: {
              include: {
                user: { select: { fullName: true, email: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        const succeeded = payments.filter((p) => p.status === 'SUCCEEDED');
        const grossRevenue = succeeded.reduce((sum, p) => sum + p.amount.toNumber(), 0);

        const kpiCards: ReportKpiCard[] = [
          { label: 'Gross Revenue', value: formatETB(grossRevenue) },
          { label: 'Paid Transactions', value: succeeded.length },
          { label: 'Pending Payments', value: payments.filter((p) => p.status === 'PENDING').length },
        ];

        const rows: ReportRow[] = payments.map((p) => ({
          transactionRef: p.providerRef || p.id.slice(-10),
          bookingRef: p.booking?.bookingRef || '—',
          guest: p.booking?.user?.fullName || '—',
          date: p.createdAt.toISOString().slice(0, 10),
          provider: p.provider,
          status: p.status,
          amount: formatETB(p.amount.toNumber()),
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [{ title: 'Property Payment Transactions', rows }],
        };
      }

      case 'occupancy': {
        const occ = await this.hotelOccupancyRate(hotel.id);
        const kpiCards: ReportKpiCard[] = [
          { label: 'Total Rooms', value: occ.totalRooms },
          { label: 'Occupied Today', value: occ.occupiedToday },
          { label: 'Occupancy Rate', value: `${(occ.occupancyRate * 100).toFixed(1)}%` },
        ];

        const rows: ReportRow[] = hotel.rooms.map((r) => ({
          roomNumber: r.roomNumber,
          roomType: r.type,
          basePrice: formatETB(r.basePrice),
          status: 'Operational',
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [{ title: 'Room Inventory Utilization', rows }],
        };
      }

      case 'cancellation': {
        const cancelled = await this.db.booking.findMany({
          where: { hotelId: hotel.id, status: 'CANCELLED', updatedAt: { gte: start, lte: end } },
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
          },
          orderBy: { updatedAt: 'desc' },
        });

        const lostValue = cancelled.reduce((s, b) => s + b.totalPrice.toNumber(), 0);
        const kpiCards: ReportKpiCard[] = [
          { label: 'Cancelled Bookings', value: cancelled.length },
          { label: 'Lost Revenue Value', value: formatETB(lostValue) },
        ];

        const rows: ReportRow[] = cancelled.map((b) => ({
          bookingRef: b.bookingRef,
          guest: b.user.fullName,
          phone: b.user.phone || '—',
          cancelledDate: b.updatedAt.toISOString().slice(0, 10),
          stayDates: `${b.checkIn.toISOString().slice(0, 10)} to ${b.checkOut.toISOString().slice(0, 10)}`,
          lostAmount: formatETB(b.totalPrice.toNumber()),
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [{ title: 'Cancelled Stays Log', rows }],
        };
      }

      case 'customer': {
        const bookings = await this.db.booking.findMany({
          where: { hotelId: hotel.id, createdAt: { gte: start, lte: end } },
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } },
            payment: { select: { status: true, amount: true } },
          },
        });

        const byCustomer = new Map<
          string,
          { customer: string; email: string; phone: string; bookings: number; spend: number }
        >();
        for (const b of bookings) {
          const entry = byCustomer.get(b.user.id) ?? {
            customer: b.user.fullName,
            email: b.user.email,
            phone: b.user.phone || '—',
            bookings: 0,
            spend: 0,
          };
          entry.bookings += 1;
          if (b.payment?.status === 'SUCCEEDED') {
            entry.spend += b.payment.amount.toNumber();
          }
          byCustomer.set(b.user.id, entry);
        }

        const customerList = Array.from(byCustomer.values()).sort((a, b) => b.spend - a.spend);
        const totalSpend = customerList.reduce((s, c) => s + c.spend, 0);

        const kpiCards: ReportKpiCard[] = [
          { label: 'Guest Count', value: customerList.length },
          { label: 'Total Spend', value: formatETB(totalSpend) },
          {
            label: 'Avg Spend / Guest',
            value: customerList.length > 0 ? formatETB(totalSpend / customerList.length) : '—',
          },
        ];

        const rows: ReportRow[] = customerList.map((c) => ({
          guestName: c.customer,
          email: c.email,
          phone: c.phone,
          completedBookings: c.bookings,
          totalSpent: formatETB(c.spend),
        }));

        return {
          title,
          scopeName,
          periodLabel,
          dateRange: dateRangeStr,
          generatedAt,
          kpiCards,
          sections: [{ title: 'Guest Stay & Spend Frequency', rows }],
        };
      }
    }
  }
}
