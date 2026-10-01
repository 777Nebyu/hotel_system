import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '../../../../generated/prisma/client';
import {
  CancelBookingTool,
  CheckRoomAvailabilityTool,
  CreateBookingTool,
  GetCustomerBookingTool,
  GetHotelInformationTool,
  GetHotelPoliciesTool,
  GetPaymentStatusTool,
} from './customer-tools';
import {
  GetManagerBookingTrendsTool,
  GetManagerOccupancyTool,
  GetManagerOverviewTool,
  GetManagerRevenueTool,
} from './manager-tools';
import {
  GetStaffRoomStatusTool,
  GetStaffTodayArrivalsTool,
} from './staff-tools';
import { GetAdminPlatformOverviewTool } from './admin-tools';

describe('AI Tools Authorization & Execution (AI-007, AI-028)', () => {
  let mockDb: any;
  let mockCatalogService: any;
  let mockBookingService: any;
  let mockReportingService: any;

  beforeEach(() => {
    mockDb = {
      booking: { findUnique: jest.fn(), findMany: jest.fn() },
      user: { findUnique: jest.fn() },
      room: { findMany: jest.fn() },
      hotelPolicy: { findUnique: jest.fn() },
      aiAuditLog: { create: jest.fn() },
    };
    mockCatalogService = {
      hotelById: jest.fn(),
      search: jest.fn(),
    };
    mockBookingService = {
      getBookingDetail: jest.fn(),
      createBooking: jest.fn(),
      cancelBooking: jest.fn(),
    };
    mockReportingService = {
      hotelOverview: jest.fn(),
      hotelOccupancyRate: jest.fn(),
      hotelMonthlyRevenue: jest.fn(),
      hotelBookingTrends: jest.fn(),
      overview: jest.fn(),
    };
  });

  describe('GetCustomerBookingTool (AI-007, AI-009)', () => {
    it('rejects with 403 when customer attempts to access another user booking', async () => {
      const tool = new GetCustomerBookingTool(mockBookingService);
      mockBookingService.getBookingDetail.mockResolvedValue({
        id: 'booking-1',
        userId: 'other-user',
        bookingRef: 'YT-2026-REF1',
        hotel: { name: 'Grand Palace' },
        checkIn: new Date(),
        checkOut: new Date(),
        status: 'CONFIRMED',
        totalPrice: 1500,
      });

      const context = {
        callerId: 'user-attacker',
        callerRole: Role.CUSTOMER,
      };

      await expect(
        tool.execute({ bookingId: 'booking-1' }, context),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns booking details when customer is the owner', async () => {
      const tool = new GetCustomerBookingTool(mockBookingService);
      mockBookingService.getBookingDetail.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-owner',
        bookingRef: 'YT-2026-REF1',
        hotel: { name: 'Grand Palace' },
        checkIn: new Date(),
        checkOut: new Date(),
        status: 'CONFIRMED',
        totalPrice: 1500,
        payment: { status: 'SUCCEEDED' },
      });

      const context = {
        callerId: 'user-owner',
        callerRole: Role.CUSTOMER,
      };

      const result: any = await tool.execute(
        { bookingId: 'booking-1' },
        context,
      );
      expect(result.id).toBe('booking-1');
      expect(result.bookingRef).toBe('YT-2026-REF1');
      expect(result.hotelName).toBe('Grand Palace');
    });
  });

  describe('CancelBookingTool (AI-007, AI-014)', () => {
    it('rejects cancellation with 403 when caller does not own the booking', async () => {
      const tool = new CancelBookingTool(mockBookingService, mockDb);
      mockDb.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'victim-user',
      });

      const context = {
        callerId: 'attacker-user',
        callerRole: Role.CUSTOMER,
      };

      await expect(
        tool.execute({ bookingId: 'booking-1' }, context),
      ).rejects.toThrow(ForbiddenException);
      expect(mockBookingService.cancelBooking).not.toHaveBeenCalled();
    });

    it('cancels successfully when caller is owner', async () => {
      const tool = new CancelBookingTool(mockBookingService, mockDb);
      mockDb.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-owner',
      });
      mockBookingService.cancelBooking.mockResolvedValue({
        id: 'booking-1',
        status: 'CANCELLED',
      });

      const context = {
        callerId: 'user-owner',
        callerRole: Role.CUSTOMER,
      };

      const result: any = await tool.execute(
        { bookingId: 'booking-1' },
        context,
      );
      expect(result.status).toBe('CANCELLED');
      expect(mockBookingService.cancelBooking).toHaveBeenCalledWith(
        'booking-1',
        'user-owner',
      );
    });
  });

  describe('Manager Tools (AI-007, AI-010)', () => {
    it('rejects overview when role is CUSTOMER', async () => {
      const tool = new GetManagerOverviewTool(mockReportingService);
      const context = {
        callerId: 'cust-1',
        callerRole: Role.CUSTOMER,
        callerHotelId: 'hotel-1',
      };

      await expect(tool.execute({}, context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects overview when callerHotelId is missing', async () => {
      const tool = new GetManagerOverviewTool(mockReportingService);
      const context = {
        callerId: 'mgr-1',
        callerRole: Role.MANAGER,
      };

      await expect(tool.execute({}, context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('executes overview hard-scoped to callerHotelId', async () => {
      const tool = new GetManagerOverviewTool(mockReportingService);
      mockReportingService.hotelOverview.mockResolvedValue({
        totalRevenue: 50000,
        confirmedBookings: 12,
      });

      const context = {
        callerId: 'mgr-1',
        callerRole: Role.MANAGER,
        callerHotelId: 'hotel-alpha',
      };

      const result: any = await tool.execute({}, context);
      expect(mockReportingService.hotelOverview).toHaveBeenCalledWith(
        'hotel-alpha',
      );
      expect(result.totalRevenue).toBe(50000);
    });

    it('executes occupancy hard-scoped to callerHotelId', async () => {
      const tool = new GetManagerOccupancyTool(mockReportingService);
      mockReportingService.hotelOccupancyRate.mockResolvedValue({
        totalRooms: 50,
        occupancyRate: 80,
      });

      const context = {
        callerId: 'mgr-1',
        callerRole: Role.MANAGER,
        callerHotelId: 'hotel-alpha',
      };

      const result: any = await tool.execute({}, context);
      expect(mockReportingService.hotelOccupancyRate).toHaveBeenCalledWith(
        'hotel-alpha',
      );
      expect(result.occupancyRate).toBe(80);
    });
  });

  describe('Staff Tools (AI-007, AI-011)', () => {
    it('rejects staff room status when caller is CUSTOMER', async () => {
      const tool = new GetStaffRoomStatusTool(mockDb);
      const context = {
        callerId: 'cust-1',
        callerRole: Role.CUSTOMER,
        callerHotelId: 'hotel-alpha',
      };

      await expect(tool.execute({}, context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns room status when caller is STAFF with assigned hotel', async () => {
      const tool = new GetStaffRoomStatusTool(mockDb);
      mockDb.room.findMany.mockResolvedValue([
        {
          id: 'room-1',
          roomNumber: '101',
          type: 'DELUXE',
          status: 'AVAILABLE',
        },
      ]);

      const context = {
        callerId: 'staff-1',
        callerRole: Role.STAFF,
        callerHotelId: 'hotel-alpha',
      };

      const result: any = await tool.execute({}, context);
      expect(mockDb.room.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hotelId: 'hotel-alpha' } }),
      );
      expect(result.totalRooms).toBe(1);
    });
  });

  describe('Admin Tools & Audit Logging (AI-007, AI-012, AI-024)', () => {
    it('rejects admin tool execution if caller is not ADMIN', async () => {
      const tool = new GetAdminPlatformOverviewTool(
        mockReportingService,
        mockDb,
      );
      const context = {
        callerId: 'mgr-1',
        callerRole: Role.MANAGER,
      };

      await expect(tool.execute({}, context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('records audit log on successful admin action', async () => {
      const tool = new GetAdminPlatformOverviewTool(
        mockReportingService,
        mockDb,
      );
      mockReportingService.overview.mockResolvedValue({
        totalHotels: 10,
        totalUsers: 100,
      });

      const context = {
        callerId: 'admin-1',
        callerRole: Role.ADMIN,
      };

      await tool.execute({}, context);

      expect(mockDb.aiAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'admin-1',
            actorRole: Role.ADMIN,
            toolName: 'getAdminPlatformOverview',
          }),
        }),
      );
    });
  });
});
