import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { Role } from '../../../generated/prisma/client';
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
      data: { isActive: dto.isActive },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });
    await this.audit.record(
      actorId,
      dto.isActive ? 'ACTIVATE' : 'DEACTIVATE',
      'User',
      userId,
      {
        isActive: { from: user.isActive, to: dto.isActive },
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
}
