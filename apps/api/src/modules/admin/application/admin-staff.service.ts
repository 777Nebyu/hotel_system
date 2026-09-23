import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, UserStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import type { HotelStaffQuery } from '@repo/shared-types';

export interface CreateStaffDto {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
}

export interface AssignStaffDto {
  staffId?: string;
  email?: string;
  role?: string;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AdminStaffService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listHotelStaff(hotelId: string, query: HotelStaffQuery) {
    await this.requireHotelExists(hotelId);
    const [total, records] = await Promise.all([
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
              role: true,
            },
          },
        },
      }),
    ]);

    const data = records.map((r) => ({
      id: r.staff.id,
      staffId: r.staffId,
      hotelId: r.hotelId,
      role: (r as any).role || 'Front Desk',
      assignedAt: r.assignedAt,
      createdAt: r.assignedAt.toISOString(),
      staff: r.staff,
      user: r.staff,
    }));

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async createAndAssignStaff(
    hotelId: string,
    dto: CreateStaffDto,
    actorId: string,
  ) {
    await this.requireHotelExists(hotelId);
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check if user already exists
    const existing = await this.db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        isActive: true,
        role: true,
      },
    });

    const staffRoleTitle = dto.role?.trim() || 'Front Desk';

    if (existing) {
      // Check if already assigned to this hotel
      const assignment = await this.db.staffHotel.findUnique({
        where: { staffId_hotelId: { staffId: existing.id, hotelId } },
      });
      if (assignment) {
        throw new ConflictException(
          'A staff member with this email is already assigned to this hotel',
        );
      }

      // Upgrade to STAFF if CUSTOMER
      if (existing.role === 'CUSTOMER') {
        await this.db.user.update({
          where: { id: existing.id },
          data: { role: Role.STAFF, status: UserStatus.ACTIVE, isActive: true },
        });
        existing.role = Role.STAFF;
      }

      await this.db.staffHotel.create({
        data: { staffId: existing.id, hotelId, role: staffRoleTitle },
      });

      await this.audit.record(actorId, 'ASSIGN_STAFF', 'Hotel', hotelId, {
        staffId: existing.id,
        email: normalizedEmail,
        role: staffRoleTitle,
      });

      return {
        id: existing.id,
        staffId: existing.id,
        hotelId,
        role: staffRoleTitle,
        assignedAt: new Date(),
        staff: existing,
        user: existing,
      };
    }

    // Hash password and create new STAFF user
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.db.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        phone: dto.phone?.trim() || null,
        role: Role.STAFF,
        status: UserStatus.ACTIVE,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        isActive: true,
        role: true,
      },
    });

    await this.db.staffHotel.create({
      data: { staffId: user.id, hotelId, role: staffRoleTitle },
    });

    await this.audit.record(actorId, 'CREATE_AND_ASSIGN_STAFF', 'Hotel', hotelId, {
      staffId: user.id,
      email: normalizedEmail,
      role: staffRoleTitle,
    });

    return {
      id: user.id,
      staffId: user.id,
      hotelId,
      role: staffRoleTitle,
      assignedAt: new Date(),
      staff: user,
      user,
    };
  }

  async assignStaff(hotelId: string, dto: AssignStaffDto, actorId: string) {
    await this.requireHotelExists(hotelId);
    const staffRoleTitle = dto.role?.trim() || 'Front Desk';
    let user: {
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
      isActive: boolean;
      role: Role;
    } | null = null;

    if (dto.staffId) {
      user = await this.db.user.findUnique({
        where: { id: dto.staffId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
          role: true,
        },
      });
    } else if (dto.email) {
      user = await this.db.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
          role: true,
        },
      });
    }

    if (!user) {
      throw new NotFoundException('User with specified ID or email was not found');
    }

    if (user.role === 'CUSTOMER') {
      await this.db.user.update({
        where: { id: user.id },
        data: { role: Role.STAFF, status: UserStatus.ACTIVE, isActive: true },
      });
      user.role = Role.STAFF;
    }

    try {
      const assignment = await this.db.staffHotel.create({
        data: { staffId: user.id, hotelId, role: staffRoleTitle },
        include: {
          staff: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              isActive: true,
              role: true,
            },
          },
          hotel: { select: { id: true, name: true } },
        },
      });

      await this.audit.record(actorId, 'ASSIGN_STAFF', 'Hotel', hotelId, {
        staffId: user.id,
        role: staffRoleTitle,
      });

      return {
        id: user.id,
        staffId: user.id,
        hotelId,
        role: (assignment as any).role || staffRoleTitle,
        assignedAt: assignment.assignedAt,
        staff: assignment.staff,
        user: assignment.staff,
      };
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

  async updateStaffRole(
    hotelId: string,
    staffId: string,
    role: string,
    actorId: string,
  ) {
    await this.requireHotelExists(hotelId);
    const assignment = await this.db.staffHotel.findUnique({
      where: { staffId_hotelId: { staffId, hotelId } },
    });
    if (!assignment) {
      throw new NotFoundException('Staff assignment not found for this hotel');
    }

    const updated = await this.db.staffHotel.update({
      where: { staffId_hotelId: { staffId, hotelId } },
      data: { role: role.trim() || 'Front Desk' },
      include: {
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
            role: true,
          },
        },
      },
    });

    await this.audit.record(actorId, 'UPDATE_STAFF_ROLE', 'Hotel', hotelId, {
      staffId,
      role: updated.role,
    });

    return {
      id: staffId,
      staffId,
      hotelId,
      role: updated.role,
      staff: updated.staff,
      user: updated.staff,
    };
  }

  async updateStaffStatus(
    hotelId: string,
    staffId: string,
    isActive: boolean,
    actorId: string,
  ) {
    await this.requireHotelExists(hotelId);
    const assignment = await this.db.staffHotel.findUnique({
      where: { staffId_hotelId: { staffId, hotelId } },
    });
    if (!assignment) {
      throw new NotFoundException('Staff assignment not found for this hotel');
    }

    const updatedUser = await this.db.user.update({
      where: { id: staffId },
      data: {
        isActive,
        status: isActive ? UserStatus.ACTIVE : UserStatus.DEACTIVATED,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        isActive: true,
        role: true,
      },
    });

    await this.audit.record(actorId, 'UPDATE_STAFF_STATUS', 'Hotel', hotelId, {
      staffId,
      isActive,
    });

    return {
      id: staffId,
      staffId,
      hotelId,
      staff: updatedUser,
      user: updatedUser,
    };
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

  async listAllAssignments() {
    return this.db.staffHotel.findMany({
      orderBy: { assignedAt: 'desc' },
      include: {
        staff: {
          select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true },
        },
        hotel: {
          select: { id: true, name: true, status: true },
        },
      },
    });
  }

  private async requireHotelExists(hotelId: string) {
    const hotel = await this.db.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
  }
}
