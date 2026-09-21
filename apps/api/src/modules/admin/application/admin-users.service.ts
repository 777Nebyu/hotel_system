import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, UserStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import type {
  AdminUsersQuery,
  SetUserActive,
  UpdateUserRole,
} from '@repo/shared-types';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminUsersQuery) {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role as Role;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [total, users] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          isFlagged: true,
          flagReason: true,
          flaggedAt: true,
          profilePhotoUrl: true,
          emailVerifiedAt: true,
          createdAt: true,
          _count: {
            select: { bookings: true, reviews: true, favorites: true },
          },
        },
      }),
    ]);
    return { data: users, total, page: query.page, pageSize: query.pageSize };
  }

  async updateRole(userId: string, dto: UpdateUserRole, actorId: string) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const updated = await this.db.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });
    await this.audit.record(actorId, 'UPDATE', 'User', userId, {
      role: { from: user.role, to: dto.role },
    });
    return updated;
  }

  async setActive(userId: string, dto: SetUserActive, actorId: string) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        isActive: dto.isActive,
        status: dto.isActive ? 'ACTIVE' : 'SUSPENDED',
        deletionScheduledFor: dto.isActive ? null : undefined,
        ...(dto.isActive
          ? {}
          : { refreshTokenHash: null, refreshTokenFamily: null }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        status: true,
      },
    });

    if (!dto.isActive) {
      await this.db.booking.updateMany({
        where: { userId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    }

    await this.audit.record(
      actorId,
      dto.isActive ? 'ACTIVATE' : 'SUSPEND',
      'User',
      userId,
      {
        isActive: { from: user.isActive, to: dto.isActive },
        status: { from: user.status, to: dto.isActive ? 'ACTIVE' : 'SUSPENDED' },
        reason: dto.reason,
      },
    );
    return updated;
  }

  async get(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        isFlagged: true,
        flagReason: true,
        flaggedAt: true,
        profilePhotoUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { bookings: true, reviews: true, favorites: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async listFlagged() {
    return this.db.user.findMany({
      where: { isFlagged: true },
      orderBy: { flaggedAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isFlagged: true,
        flagReason: true,
        flaggedAt: true,
        createdAt: true,
        _count: {
          select: { bookings: true, reviews: true, favorites: true },
        },
      },
    });
  }

  async flagUser(userId: string, reason: string, actorId: string) {
    await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        isFlagged: true,
        flagReason: reason,
        flaggedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isFlagged: true,
        flagReason: true,
        flaggedAt: true,
      },
    });
    await this.audit.record(actorId, 'USER_FLAGGED', 'User', userId, {
      reason,
    });
    return updated;
  }

  async unflagUser(userId: string, reason: string | undefined, actorId: string) {
    await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        isFlagged: false,
        flagReason: null,
        flaggedAt: null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isFlagged: true,
        flagReason: true,
        flaggedAt: true,
      },
    });
    await this.audit.record(actorId, 'USER_UNFLAGGED', 'User', userId, {
      reason: reason || 'Manual unflag by admin',
    });
    return updated;
  }

  async create(
    dto: {
      fullName: string;
      email: string;
      password: string;
      phone?: string | null;
      role?: 'CUSTOMER' | 'MANAGER' | 'STAFF' | 'ADMIN';
      hotelId?: string | null;
    },
    actorId: string,
  ) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Check existing user
    const existing = await this.db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });
    if (existing) {
      throw new ConflictException(
        'A user with this email address already exists.',
      );
    }

    // 2. Validate hotel if hotelId provided
    if (dto.hotelId) {
      const hotel = await this.db.hotel.findUnique({
        where: { id: dto.hotelId },
        select: { id: true, name: true },
      });
      if (!hotel) {
        throw new NotFoundException('Selected hotel does not exist.');
      }
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // 4. Create user with pre-verified status
    const targetRole = (dto.role as Role) || Role.MANAGER;
    const user = await this.db.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        phone: dto.phone?.trim() || null,
        role: targetRole,
        status: UserStatus.ACTIVE,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        status: true,
        createdAt: true,
      },
    });

    // 5. If hotelId provided, assign accordingly
    let assignedHotel: { id: string; name: string } | null = null;
    if (dto.hotelId) {
      if (targetRole === Role.MANAGER) {
        assignedHotel = await this.db.hotel.update({
          where: { id: dto.hotelId },
          data: { managerId: user.id },
          select: { id: true, name: true },
        });
      } else if (targetRole === Role.STAFF) {
        await this.db.staffHotel.create({
          data: {
            staffId: user.id,
            hotelId: dto.hotelId,
            role: 'Staff',
          },
        });
        const hotel = await this.db.hotel.findUnique({
          where: { id: dto.hotelId },
          select: { id: true, name: true },
        });
        assignedHotel = hotel;
      }
    }

    // 6. Audit log
    await this.audit.record(actorId, 'CREATE_USER', 'User', user.id, {
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      assignedHotelId: dto.hotelId || null,
    });

    return {
      ...user,
      assignedHotel,
    };
  }
}
