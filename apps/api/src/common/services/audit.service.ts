import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly db: PrismaService) {}

  record(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    diff?: Prisma.InputJsonValue,
  ) {
    void this.db.auditLog
      .create({
        data: { actorId, action, entity, entityId, diff: diff ?? undefined },
      })
      .catch((err) => this.logger.warn(`Audit log failed: ${err}`));
  }
}
