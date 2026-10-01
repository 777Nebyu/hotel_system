import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../../generated/prisma/client';
import { AIService } from './ai.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { RagService } from './rag.service';
import { MockAIProvider } from '../infrastructure/providers/mock-ai.provider';

describe('AIService Integration & Rules (AI-001 through AI-028)', () => {
  let service: AIService;
  let mockDb: any;
  let mockToolRegistry: any;
  let mockRagService: any;
  let mockProvider: any;
  let mockConfig: any;

  beforeEach(() => {
    mockDb = {
      aiConversation: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      aiMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    };

    mockToolRegistry = {
      getAllowedToolDefinitions: jest.fn().mockReturnValue([]),
      executeTool: jest.fn(),
    };

    mockRagService = {
      retrieveContext: jest.fn().mockResolvedValue(''),
    };

    mockProvider = {
      generateResponse: jest.fn(),
      transcribeAudio: jest.fn(),
      synthesizeSpeech: jest.fn(),
    };

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'ai.historyLimit') return 10;
        if (key === 'ai.maxToolIterations') return 3;
        return undefined;
      }),
    };

    service = new AIService(
      mockProvider,
      mockToolRegistry,
      mockRagService,
      mockDb,
      mockConfig,
    );
  });

  describe('AI-004: Conversation Ownership Scoping', () => {
    it('throws 403 Forbidden when conversation ownership mismatches callerId', async () => {
      mockDb.aiConversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        userId: 'victim-user',
        hotelId: null,
      });

      await expect(
        service.chat({
          userId: 'attacker-user',
          role: Role.CUSTOMER,
          message: 'Hello',
          conversationId: 'conv-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates a new conversation if conversationId is not provided', async () => {
      mockDb.aiConversation.create.mockResolvedValue({
        id: 'new-conv',
        userId: 'user-1',
        hotelId: null,
      });
      mockProvider.generateResponse.mockResolvedValue({
        text: 'Hello, how can I help?',
      });

      const result = await service.chat({
        userId: 'user-1',
        role: Role.CUSTOMER,
        message: 'Hello',
      });

      expect(mockDb.aiConversation.create).toHaveBeenCalled();
      expect(result.conversationId).toBe('new-conv');
      expect(result.message).toBe('Hello, how can I help?');
    });
  });

  describe('AI-005: Bounded Conversation History', () => {
    it('loads at most historyLimit past messages', async () => {
      mockDb.aiConversation.create.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        hotelId: null,
      });
      mockProvider.generateResponse.mockResolvedValue({
        text: 'Welcome!',
      });

      await service.chat({
        userId: 'user-1',
        role: Role.CUSTOMER,
        message: 'Test history limit',
      });

      expect(mockDb.aiMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });
  });

  describe('AI-007, AI-008 & AI-021: Tool Execution Loop & Authorization Enforcement', () => {
    it('handles tool calls and loops back to provider with result', async () => {
      mockDb.aiConversation.create.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        hotelId: 'hotel-1',
      });

      // First turn: provider requests a tool call
      mockProvider.generateResponse
        .mockResolvedValueOnce({
          toolCalls: [
            {
              id: 'call-1',
              name: 'checkRoomAvailability',
              args: { checkIn: '2026-10-01' },
            },
          ],
        })
        // Second turn: provider outputs final answer using tool result
        .mockResolvedValueOnce({
          text: 'There are 3 deluxe rooms available on 2026-10-01.',
        });

      mockToolRegistry.executeTool.mockResolvedValue({
        result: { availableRooms: 3 },
      });

      const result = await service.chat({
        userId: 'user-1',
        role: Role.CUSTOMER,
        hotelId: 'hotel-1',
        message: 'Check availability for 2026-10-01',
      });

      expect(mockToolRegistry.executeTool).toHaveBeenCalledWith(
        'checkRoomAvailability',
        { checkIn: '2026-10-01' },
        expect.objectContaining({
          callerId: 'user-1',
          callerRole: Role.CUSTOMER,
        }),
      );
      expect(result.toolCallsExecuted).toContain('checkRoomAvailability');
      expect(result.message).toBe(
        'There are 3 deluxe rooms available on 2026-10-01.',
      );
    });

    it('enforces tool iteration cap (AI-021) to prevent infinite loops', async () => {
      mockDb.aiConversation.create.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        hotelId: null,
      });

      // Always requests another tool call
      mockProvider.generateResponse.mockResolvedValue({
        toolCalls: [
          { id: 'loop-call', name: 'checkRoomAvailability', args: {} },
        ],
      });
      mockToolRegistry.executeTool.mockResolvedValue({ result: 'ok' });

      const result = await service.chat({
        userId: 'user-1',
        role: Role.CUSTOMER,
        message: 'Trigger loop',
      });

      expect(mockProvider.generateResponse).toHaveBeenCalledTimes(3); // capped at maxToolIterations = 3
      expect(result.message).toContain(
        'unable to complete all required tool operations',
      );
    });
  });

  describe('AI-023: AI Provider Failure Handling', () => {
    it('catches provider errors and surfaces a calm friendly error to user without crashing', async () => {
      mockDb.aiConversation.create.mockResolvedValue({
        id: 'conv-1',
        userId: 'user-1',
        hotelId: null,
      });

      mockProvider.generateResponse.mockRejectedValue(
        new Error('Gemini upstream timeout 504'),
      );

      const result = await service.chat({
        userId: 'user-1',
        role: Role.CUSTOMER,
        message: 'Hello',
      });

      expect(result.message).toContain('temporarily experiencing difficulties');
      expect(result.message).not.toContain('Gemini upstream timeout');
    });
  });

  describe('AI-019 & AI-020: Voice Modality Pipeline', () => {
    it('transcribes voice server-side and routes text through the chat pipeline', async () => {
      mockDb.aiConversation.create.mockResolvedValue({
        id: 'voice-conv',
        userId: 'user-1',
        hotelId: null,
      });

      mockProvider.transcribeAudio.mockResolvedValue(
        'What is the hotel check in policy?',
      );
      mockProvider.generateResponse.mockResolvedValue({
        text: 'Check-in is at 14:00.',
      });
      mockProvider.synthesizeSpeech.mockResolvedValue(
        Buffer.from('dummy-audio-bytes'),
      );

      const result = await service.voice({
        userId: 'user-1',
        role: Role.CUSTOMER,
        audioBuffer: Buffer.from('mock-audio'),
        mimeType: 'audio/wav',
      });

      expect(mockProvider.transcribeAudio).toHaveBeenCalled();
      expect(result.transcript).toBe('What is the hotel check in policy?');
      expect(result.message).toBe('Check-in is at 14:00.');
      expect(result.audioBase64).toBeDefined();
    });
  });
});
