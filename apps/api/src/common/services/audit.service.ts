import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly db: PrismaService) {}

  async record(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    diff?: Prisma.InputJsonValue,
  ) {
    await this.db.auditLog.create({
      data: { actorId, action, entity, entityId, diff: diff ?? undefined },
    });
  }
}
