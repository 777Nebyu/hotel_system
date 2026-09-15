import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  AdminBookingsQuery,
  AdminPaymentsQuery,
} from '@repo/shared-types';

@Injectable()
export class AdminBookingService {
  constructor(private readonly db: PrismaService) {}

  async listBookings(query: AdminBookingsQuery) {
    const where: Prisma.BookingWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.hotelId) where.hotelId = query.hotelId;
    if (query.userId) where.userId = query.userId;
    const [total, bookings] = await Promise.all([
      this.db.booking.count({ where }),
      this.db.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          hotel: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true, email: true } },
          payment: true,
        },
      }),
    ]);
    return {
      data: bookings,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getBooking(bookingId: string) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        hotel: true,
        user: true,
        details: { include: { room: true } },
        payment: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async listPayments(query: AdminPaymentsQuery) {
    const where: Prisma.PaymentWhereInput = {};
    if (query.status) where.status = query.status;
    const [total, payments] = await Promise.all([
      this.db.payment.count({ where }),
      this.db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          booking: {
            select: {
              id: true,
              totalPrice: true,
              hotel: { select: { name: true } },
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      }),
    ]);
    return {
      data: payments,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
