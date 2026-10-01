import { Injectable, Logger } from '@nestjs/common';
import { AIProvider } from './ai-provider.interface';
import {
  AIProviderChatInput,
  AIProviderChatOutput,
  AIToolCall,
} from '../../domain/ai.types';

@Injectable()
export class MockAIProvider implements AIProvider {
  private readonly logger = new Logger(MockAIProvider.name);

  async generateResponse(
    input: AIProviderChatInput,
  ): Promise<AIProviderChatOutput> {
    this.logger.debug(
      `[MockAIProvider] Generating response for message: "${input.message}"`,
    );
    const lower = input.message.toLowerCase();

    // Check if the last turn was a tool execution result
    const lastHistoryItem = input.history[input.history.length - 1];
    if (
      lastHistoryItem?.toolResults &&
      lastHistoryItem.toolResults.length > 0
    ) {
      const resultObj = lastHistoryItem.toolResults[0].result;
      return {
        text: `Here is the information you requested based on the tool results: ${JSON.stringify(resultObj)}`,
      };
    }

    // Check if prompt matches any available tool capability
    if (input.tools && input.tools.length > 0) {
      const toolNames = new Set(input.tools.map((t) => t.name));

      // Customer tool triggers
      if (
        (lower.includes('available') || lower.includes('room')) &&
        toolNames.has('checkRoomAvailability')
      ) {
        return {
          toolCalls: [
            {
              id: 'call_' + Math.random().toString(36).slice(2, 9),
              name: 'checkRoomAvailability',
              args: {},
            },
          ],
        };
      }

      if (
        (lower.includes('my booking') || lower.includes('booking detail')) &&
        toolNames.has('getCustomerBooking')
      ) {
        return {
          toolCalls: [
            {
              id: 'call_' + Math.random().toString(36).slice(2, 9),
              name: 'getCustomerBooking',
              args: {},
            },
          ],
        };
      }

      if (lower.includes('policy') && toolNames.has('getHotelPolicies')) {
        return {
          toolCalls: [
            {
              id: 'call_' + Math.random().toString(36).slice(2, 9),
              name: 'getHotelPolicies',
              args: {},
            },
          ],
        };
      }

      if (
        lower.includes('hotel info') &&
        toolNames.has('getHotelInformation')
      ) {
        return {
          toolCalls: [
            {
              id: 'call_' + Math.random().toString(36).slice(2, 9),
              name: 'getHotelInformation',
              args: {},
            },
          ],
        };
      }

      // Manager tool triggers
      if (
        (lower.includes('overview') ||
          lower.includes('kpi') ||
          lower.includes('metrics')) &&
        toolNames.has('getManagerOverview')
      ) {
        return {
          toolCalls: [
            {
              id: 'call_' + Math.random().toString(36).slice(2, 9),
              name: 'getManagerOverview',
              args: {},
            },
          ],
        };
      }

      if (lower.includes('occupancy') && toolNames.has('getManagerOccupancy')) {
        return {
          toolCalls: [
            {
              id: 'call_' + Math.random().toString(36).slice(2, 9),
              name: 'getManagerOccupancy',
              args: {},
            },
          ],
        };
      }

      if (lower.includes('revenue') && toolNames.has('getManagerRevenue')) {
        return {
          toolCalls: [
            {
              id: 'call_' + Math.random().toString(36).slice(2, 9),
              name: 'getManagerRevenue',
              args: {},
            },
          ],
        };
      }

      // Staff tool triggers
      if (
        lower.includes('room status') &&
        toolNames.has('getStaffRoomStatus')
      ) {
        return {
          toolCalls: [
            {
              id: 'call_' + Math.random().toString(36).slice(2, 9),
              name: 'getStaffRoomStatus',
              args: {},
            },
          ],
        };
      }

      if (lower.includes('arrival') && toolNames.has('getStaffTodayArrivals')) {
        return {
          toolCalls: [
            {
              id: 'call_' + Math.random().toString(36).slice(2, 9),
              name: 'getStaffTodayArrivals',
              args: {},
            },
          ],
        };
      }

      // Admin tool triggers
      if (
        lower.includes('admin') &&
        toolNames.has('getAdminPlatformOverview')
      ) {
        return {
          toolCalls: [
            {
              id: 'call_' + Math.random().toString(36).slice(2, 9),
              name: 'getAdminPlatformOverview',
              args: {},
            },
          ],
        };
      }
    }

    // Default conversational response
    return {
      text: `Hello! I am your LuxStay AI assistant. How can I help you today with your reservations, hotel information, or operations?`,
    };
  }

  async transcribeAudio(
    audio: Buffer,
    _mimeType: string,
    _language?: string,
  ): Promise<string> {
    this.logger.debug(
      `[MockAIProvider] Transcribing ${audio.length} bytes of audio`,
    );
    return 'Check room availability for today';
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    this.logger.debug(
      `[MockAIProvider] Synthesizing speech for ${text.length} chars`,
    );
    // Minimal valid WAV header for a silent/beep placeholder
    return Buffer.from(
      'RIFF$    WAVEfmt \x10   \x01 \x01 D\xac  D\xac  \x01 \x08 data    ',
      'ascii',
    );
  }
}
