import { ForbiddenException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Role } from '../../../../generated/prisma/client';
import { AdminReportingService } from '../../../admin-reporting/application/admin-reporting.service';
import { AITool } from '../../domain/ai-tool.interface';
import { AIToolContext, AIToolDefinition } from '../../domain/ai.types';

// ── 1. getManagerOverview ───────────────────────────────────────────────────
@Injectable()
export class GetManagerOverviewTool implements AITool {
  readonly name = 'getManagerOverview';
  readonly description =
    'Get operational and financial KPI summary for the assigned hotel';
  readonly definition: AIToolDefinition = {
    name: 'getManagerOverview',
    description:
      'Retrieve current occupancy, revenue, active bookings and room counts for your hotel.',
    parameters: {
      type: 'object',
      properties: {},
    },
  };

  constructor(private readonly reporting: AdminReportingService) {}

  async execute(_rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    // AI-007 & AI-010: Validate Role and hard-scope to context.callerHotelId
    if (!context || context.callerRole !== Role.MANAGER) {
      throw new ForbiddenException(
        'Only hotel managers may access manager overview metrics',
      );
    }
    if (!context.callerHotelId) {
      throw new ForbiddenException(
        'No hotel scope assigned to manager context',
      );
    }

    const data = await this.reporting.hotelOverview(context.callerHotelId);
    return data;
  }
}

// ── 2. getManagerOccupancy ──────────────────────────────────────────────────
@Injectable()
export class GetManagerOccupancyTool implements AITool {
  readonly name = 'getManagerOccupancy';
  readonly description =
    'Get real-time room occupancy rates and breakdown for the assigned hotel';
  readonly definition: AIToolDefinition = {
    name: 'getManagerOccupancy',
    description:
      'Retrieve total rooms, occupied rooms, and occupancy percentage for your assigned hotel.',
    parameters: {
      type: 'object',
      properties: {},
    },
  };

  constructor(private readonly reporting: AdminReportingService) {}

  async execute(_rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    if (!context || context.callerRole !== Role.MANAGER) {
      throw new ForbiddenException(
        'Only hotel managers may access occupancy metrics',
      );
    }
    if (!context.callerHotelId) {
      throw new ForbiddenException(
        'No hotel scope assigned to manager context',
      );
    }

    return await this.reporting.hotelOccupancyRate(context.callerHotelId);
  }
}

// ── 3. getManagerRevenue ────────────────────────────────────────────────────
const getManagerRevenueSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

@Injectable()
export class GetManagerRevenueTool implements AITool {
  readonly name = 'getManagerRevenue';
  readonly description = 'Get monthly revenue trends for the assigned hotel';
  readonly definition: AIToolDefinition = {
    name: 'getManagerRevenue',
    description: 'Retrieve monthly revenue data for your assigned hotel.',
    parameters: {
      type: 'object',
      properties: {
        months: {
          type: 'number',
          description: 'Number of past months to retrieve (1-24)',
        },
      },
    },
  };

  constructor(private readonly reporting: AdminReportingService) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    if (!context || context.callerRole !== Role.MANAGER) {
      throw new ForbiddenException(
        'Only hotel managers may access hotel revenue analytics',
      );
    }
    if (!context.callerHotelId) {
      throw new ForbiddenException(
        'No hotel scope assigned to manager context',
      );
    }

    const parsed = getManagerRevenueSchema.safeParse(rawArgs || {});
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const months = parsed.data.months;

    return await this.reporting.hotelMonthlyRevenue(
      context.callerHotelId,
      months,
    );
  }
}

// ── 4. getManagerBookingTrends ──────────────────────────────────────────────
const getManagerBookingTrendsSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

@Injectable()
export class GetManagerBookingTrendsTool implements AITool {
  readonly name = 'getManagerBookingTrends';
  readonly description =
    'Get daily booking counts and trends for the assigned hotel';
  readonly definition: AIToolDefinition = {
    name: 'getManagerBookingTrends',
    description:
      'Retrieve daily booking creation trends for your assigned hotel.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to check (1-90)' },
      },
    },
  };

  constructor(private readonly reporting: AdminReportingService) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    if (!context || context.callerRole !== Role.MANAGER) {
      throw new ForbiddenException(
        'Only hotel managers may access booking trends',
      );
    }
    if (!context.callerHotelId) {
      throw new ForbiddenException(
        'No hotel scope assigned to manager context',
      );
    }

    const parsed = getManagerBookingTrendsSchema.safeParse(rawArgs || {});
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const days = parsed.data.days;

    return await this.reporting.hotelBookingTrends(context.callerHotelId, days);
  }
}
