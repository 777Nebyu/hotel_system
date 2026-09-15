import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import type { AuditLogsQuery, UpsertSetting } from '@repo/shared-types';

@Injectable()
export class AdminSettingService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listSettings() {
    return this.db.platformSetting.findMany({ orderBy: { key: 'asc' } });
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
