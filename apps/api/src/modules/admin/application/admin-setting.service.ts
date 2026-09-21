import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import type { AuditLogsQuery, UpsertSetting } from '@repo/shared-types';

export const DEFAULT_PLATFORM_SETTINGS: Record<string, Record<string, unknown>> = {
  COMMISSION_AND_TAX: {
    platformFeePercent: 10,
    vatRate: 15,
    defaultCurrency: 'ETB',
    minPayoutAmount: 5000,
    payoutSchedule: 'WEEKLY',
  },
  BOOKING_POLICIES: {
    holdDurationMinutes: 30,
    cancellationGraceHours: 24,
    maxRoomsPerBooking: 10,
    autoConfirmBookings: true,
    allowEarlyCheckIn: true,
  },
  SECURITY_AND_AUTH: {
    passwordMinLength: 8,
    require2FAForStaff: false,
    sessionTimeoutHours: 72,
    maxLoginAttempts: 5,
    enableAuditLogging: true,
  },
  NOTIFICATIONS_GATEWAY: {
    supportEmail: 'support@luxstay.com',
    smsProvider: 'MOCK',
    emailDispatchMode: 'SMTP',
    notifyOnBooking: true,
    notifyOnCancellation: true,
  },
  PLATFORM_OPERATIONS: {
    maintenanceMode: false,
    maintenanceMessage: 'LuxStay is currently undergoing scheduled platform maintenance.',
    autoApproveHotels: false,
    maxUploadSizeMb: 15,
  },
};

@Injectable()
export class AdminSettingService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listSettings() {
    const existing = await this.db.platformSetting.findMany({ orderBy: { key: 'asc' } });
    const existingKeys = new Set(existing.map((s) => s.key));

    // Auto-seed missing default settings so platform has standard categories out-of-the-box
    const missingKeys = Object.keys(DEFAULT_PLATFORM_SETTINGS).filter((k) => !existingKeys.has(k));
    if (missingKeys.length > 0) {
      for (const key of missingKeys) {
        try {
          const val = DEFAULT_PLATFORM_SETTINGS[key] as unknown as Prisma.InputJsonValue;
          const created = await this.db.platformSetting.create({
            data: { key, value: val },
          });
          existing.push(created);
        } catch {
          // Ignore unique race condition
        }
      }
      existing.sort((a, b) => a.key.localeCompare(b.key));
    }

    return existing;
  }

  async upsertSetting(key: string, dto: UpsertSetting, actorId: string) {
    const before = await this.db.platformSetting.findUnique({ where: { key } });
    const value = dto.value as unknown as Prisma.InputJsonValue;
    const setting = await this.db.platformSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    await this.audit.record(actorId, 'UPSERT', 'PlatformSetting', key, {
      before: before?.value ?? null,
      after: dto.value as unknown as Prisma.InputJsonValue,
    });
    return setting;
  }

  async removeSetting(key: string, actorId: string) {
    const existing = await this.db.platformSetting.findUnique({
      where: { key },
    });
    if (!existing) throw new NotFoundException('Setting not found');
    await this.db.platformSetting.delete({ where: { key } });
    await this.audit.record(actorId, 'DELETE', 'PlatformSetting', key, {
      value: existing.value,
    });
    return { ok: true };
  }

  async auditLogs(query: AuditLogsQuery) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.entity) where.entity = query.entity;
    if (query.action) where.action = query.action;
    if (query.actorId) where.actorId = query.actorId;
    const [total, logs] = await Promise.all([
      this.db.auditLog.count({ where }),
      this.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);
    return { data: logs, total, page: query.page, pageSize: query.pageSize };
  }
}
