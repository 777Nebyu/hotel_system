import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogModule } from '../catalog/catalog.module';
import { BookingModule } from '../booking/booking.module';
import { AdminReportingModule } from '../admin-reporting/admin-reporting.module';
import { AIController } from './presentation/ai.controller';
import { AIService } from './application/ai.service';
import { RagService } from './application/rag.service';
import { ToolRegistryService } from './application/tools/tool-registry.service';
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
} from './application/tools/customer-tools';
import {
  GetManagerBookingTrendsTool,
  GetManagerOccupancyTool,
  GetManagerOverviewTool,
  GetManagerRevenueTool,
} from './application/tools/manager-tools';
import {
  GetStaffRoomStatusTool,
  GetStaffTodayArrivalsTool,
} from './application/tools/staff-tools';
import { GetAdminPlatformOverviewTool } from './application/tools/admin-tools';
import {
  AI_PROVIDER_TOKEN,
  AIProvider,
} from './infrastructure/providers/ai-provider.interface';
import { FallbackAIProvider } from './infrastructure/providers/fallback-ai.provider';
import { GeminiProvider } from './infrastructure/providers/gemini.provider';
import { MockAIProvider } from './infrastructure/providers/mock-ai.provider';

@Module({
  imports: [PrismaModule, CatalogModule, BookingModule, AdminReportingModule],
  controllers: [AIController],
  providers: [
    // AI-001 — Provider Abstraction with dynamic switching
    GeminiProvider,
    MockAIProvider,
    {
      provide: AI_PROVIDER_TOKEN,
      useFactory: (
        config: ConfigService,
        gemini: GeminiProvider,
        mock: MockAIProvider,
      ): AIProvider => {
        const providerName = config.get<string>('ai.provider') || 'mock';
        const fallbackName = config.get<string>('ai.fallback') ?? 'mock';
        const apiKey = config.get<string>('ai.geminiApiKey');
        const primary: AIProvider =
          providerName === 'gemini' && apiKey ? gemini : mock;

        const resolve = (name: string): AIProvider | undefined => {
          if (name === 'none') return undefined;
          if (name === 'gemini') return apiKey ? gemini : undefined;
          return mock;
        };

        const fallback = resolve(fallbackName);
        if (!fallback || fallback === primary) return primary;
        return new FallbackAIProvider(primary, fallback, fallbackName);
      },
      inject: [ConfigService, GeminiProvider, MockAIProvider],
    },
    // RAG and Tools
    RagService,
    ToolRegistryService,
    CheckRoomAvailabilityTool,
    GetCustomerBookingTool,
    CreateBookingTool,
    CancelBookingTool,
    GetPaymentStatusTool,
    GetHotelInformationTool,
    GetHotelPoliciesTool,
    GetNearbyPlacesTool,
    GetHeritageInfoTool,
    GetEmergencyContactsTool,
    GetManagerOverviewTool,
    GetManagerOccupancyTool,
    GetManagerRevenueTool,
    GetManagerBookingTrendsTool,
    GetStaffRoomStatusTool,
    GetStaffTodayArrivalsTool,
    GetAdminPlatformOverviewTool,
    // Core Application Service
    AIService,
  ],
  exports: [AIService],
})
export class AiModule {}
