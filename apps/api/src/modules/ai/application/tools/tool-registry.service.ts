import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AITool } from '../../domain/ai-tool.interface';
import { AIToolContext, AIToolDefinition } from '../../domain/ai.types';
import {
  CancelBookingTool,
  CheckRoomAvailabilityTool,
  CreateBookingTool,
  GetCustomerBookingTool,
  GetEmergencyContactsTool,
  GetHeritageInfoTool,
  GetHotelInformationTool,
  GetHotelPoliciesTool,
  GetNearbyPlacesTool,
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

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, AITool>();

  constructor(
    private readonly checkRoomAvailability: CheckRoomAvailabilityTool,
    private readonly getCustomerBooking: GetCustomerBookingTool,
    private readonly createBooking: CreateBookingTool,
    private readonly cancelBooking: CancelBookingTool,
    private readonly getPaymentStatus: GetPaymentStatusTool,
    private readonly getHotelInformation: GetHotelInformationTool,
    private readonly getHotelPolicies: GetHotelPoliciesTool,
    private readonly getNearbyPlaces: GetNearbyPlacesTool,
    private readonly getHeritageInfo: GetHeritageInfoTool,
    private readonly getEmergencyContacts: GetEmergencyContactsTool,
    private readonly getManagerOverview: GetManagerOverviewTool,
    private readonly getManagerOccupancy: GetManagerOccupancyTool,
    private readonly getManagerRevenue: GetManagerRevenueTool,
    private readonly getManagerBookingTrends: GetManagerBookingTrendsTool,
    private readonly getStaffRoomStatus: GetStaffRoomStatusTool,
    private readonly getStaffTodayArrivals: GetStaffTodayArrivalsTool,
    private readonly getAdminPlatformOverview: GetAdminPlatformOverviewTool,
    private readonly db: PrismaService,
  ) {
    this.register(checkRoomAvailability);
    this.register(getCustomerBooking);
    this.register(createBooking);
    this.register(cancelBooking);
    this.register(getPaymentStatus);
    this.register(getHotelInformation);
    this.register(getHotelPolicies);
    this.register(getNearbyPlaces);
    this.register(getHeritageInfo);
    this.register(getEmergencyContacts);
    this.register(getManagerOverview);
    this.register(getManagerOccupancy);
    this.register(getManagerRevenue);
    this.register(getManagerBookingTrends);
    this.register(getStaffRoomStatus);
    this.register(getStaffTodayArrivals);
    this.register(getAdminPlatformOverview);
  }

  private register(tool: AITool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  getAllowedToolDefinitions(role: Role): AIToolDefinition[] {
    const allowedNames = this.getAllowedToolNames(role);
    return allowedNames
      .map((name) => this.tools.get(name)?.definition)
      .filter((d): d is AIToolDefinition => d !== undefined);
  }

  getAllowedToolNames(role: Role): string[] {
    const commonDiscoverTools = [
      'getNearbyPlaces',
      'getHeritageInfo',
      'getEmergencyContacts',
    ];

    switch (role) {
      case Role.CUSTOMER:
        // AI-009 — Customer AI Scope
        return [
          'checkRoomAvailability',
          'getCustomerBooking',
          'createBooking',
          'cancelBooking',
          'getPaymentStatus',
          'getHotelInformation',
          'getHotelPolicies',
          ...commonDiscoverTools,
        ];
      case Role.MANAGER:
        // AI-010 — Hotel Manager AI Scope
        return [
          'getManagerOverview',
          'getManagerOccupancy',
          'getManagerRevenue',
          'getManagerBookingTrends',
          'getStaffRoomStatus',
          'getStaffTodayArrivals',
          'getHotelInformation',
          'getHotelPolicies',
          ...commonDiscoverTools,
        ];
      case Role.STAFF:
        // AI-011 — Hotel Staff AI Scope
        return [
          'getStaffRoomStatus',
          'getStaffTodayArrivals',
          'getHotelInformation',
          'getHotelPolicies',
          ...commonDiscoverTools,
        ];
      case Role.ADMIN:
        // AI-012 — System Admin AI Scope
        return [
          'getAdminPlatformOverview',
          'getHotelInformation',
          'getHotelPolicies',
          ...commonDiscoverTools,
        ];
      default:
        return [
          'getHotelInformation',
          'getHotelPolicies',
          ...commonDiscoverTools,
        ];
    }
  }

  async executeTool(
    toolName: string,
    rawArgs: unknown,
    context: AIToolContext,
  ): Promise<{ result?: unknown; error?: string; isError?: boolean }> {
    const allowed = this.getAllowedToolNames(context.callerRole);
    if (!allowed.includes(toolName)) {
      this.logger.warn(
        `Unauthorized tool call attempt: ${toolName} by user ${context.callerId} with role ${context.callerRole}`,
      );
      return {
        error: `403 Forbidden: The tool "${toolName}" is not authorized for your role (${context.callerRole}).`,
        isError: true,
      };
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        error: `Tool "${toolName}" not found.`,
        isError: true,
      };
    }

    try {
      const result = await tool.execute(rawArgs, context);
      if (
        context.callerRole === Role.ADMIN &&
        !(tool as AITool & { auditHandled?: boolean }).auditHandled
      ) {
        await this.recordAdminAudit(
          toolName,
          rawArgs,
          context,
          `Tool completed: ${JSON.stringify(result).slice(0, 500)}`,
        );
      }
      return { result };
    } catch (err: any) {
      this.logger.warn(`Tool execution error [${toolName}]: ${err.message}`);
      if (
        context.callerRole === Role.ADMIN &&
        !(tool as AITool & { auditHandled?: boolean }).auditHandled
      ) {
        await this.recordAdminAudit(
          toolName,
          rawArgs,
          context,
          `Tool failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (err instanceof ForbiddenException) {
        return {
          error: `403 Forbidden: ${err.message}`,
          isError: true,
        };
      }
      return {
        error: err instanceof Error ? err.message : String(err),
        isError: true,
      };
    }
  }

  private async recordAdminAudit(
    toolName: string,
    rawArgs: unknown,
    context: AIToolContext,
    resultSummary: string,
  ): Promise<void> {
    try {
      await this.db.aiAuditLog.create({
        data: {
          actorId: context.callerId,
          actorRole: context.callerRole,
          hotelId: context.callerHotelId,
          toolName,
          arguments: (rawArgs as any) || {},
          resultSummary,
        },
      });
    } catch (error) {
      this.logger.error(
        `Unable to persist AI admin audit for ${toolName}`,
        error,
      );
    }
  }
}
