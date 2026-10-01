import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AdminReportingService } from '../../../admin-reporting/application/admin-reporting.service';
import { AITool } from '../../domain/ai-tool.interface';
import { AIToolContext, AIToolDefinition } from '../../domain/ai.types';

// ── 1. getAdminPlatformOverview ─────────────────────────────────────────────
@Injectable()
export class GetAdminPlatformOverviewTool implements AITool {
  readonly auditHandled = true;
  readonly name = 'getAdminPlatformOverview';
  readonly description =
    'Get system-wide platform statistics, total revenue, bookings, and active users';
  readonly definition: AIToolDefinition = {
    name: 'getAdminPlatformOverview',
    description:
      'Retrieve system-wide executive dashboard summary. System Admin only.',
    parameters: {
      type: 'object',
      properties: {},
    },
  };

  constructor(
    private readonly reporting: AdminReportingService,
    private readonly db: PrismaService,
  ) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    // AI-007 & AI-012: Ensure ADMIN role
    if (!context || context.callerRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only system administrators can access system-wide overview metrics',
      );
    }

    const data = await this.reporting.overview();

    // AI-024: Admin AI Actions Are Audit-Logged
    await this.db.aiAuditLog.create({
      data: {
        actorId: context.callerId,
        actorRole: context.callerRole,
        toolName: this.name,
        arguments: (rawArgs as any) || {},
        resultSummary: `Overview retrieved: ${JSON.stringify(data).slice(0, 200)}`,
      },
    });

    return data;
  }
}
