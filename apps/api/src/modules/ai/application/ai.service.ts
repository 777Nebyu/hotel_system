import {
  ForbiddenException,
  Inject,
  Optional,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import {
  AIMessage,
  AIToolCall,
  AIToolContext,
  AIToolResult,
} from '../domain/ai.types';
import type { AIProvider } from '../infrastructure/providers/ai-provider.interface';
import { AI_PROVIDER_TOKEN } from '../infrastructure/providers/ai-provider.interface';
import { RagService } from './rag.service';
import { ToolRegistryService } from './tools/tool-registry.service';

export interface ChatOptions {
  userId: string;
  role: Role;
  hotelId?: string;
  message: string;
  conversationId?: string;
  /** UI language of the caller ('en' | 'am'); drives the reply language. */
  language?: string;
}

export interface VoiceOptions {
  userId: string;
  role: Role;
  hotelId?: string;
  audioBuffer: Buffer;
  mimeType: string;
  conversationId?: string;
  /** UI language of the speaker ('en' | 'am'); drives transcription and reply. */
  language?: string;
}

export interface ChatPlaceCard {
  id: string;
  name: string;
  category?: string;
  distanceKm?: number;
  images?: unknown[];
  verifiedSource?: { name: string; license?: string | null } | null;
  lastVerifiedAt?: Date | string | null;
}

export interface ChatResult {
  conversationId: string;
  message: string;
  toolCallsExecuted: string[];
  placeCards?: ChatPlaceCard[];
}

export interface VoiceResult extends ChatResult {
  transcript: string;
  audioBase64?: string;
}

@Injectable()
export class AIService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AIService.name);
  private readonly historyLimit: number;
  private readonly maxToolIterations: number;
  private readonly rateLimitPerUser: number;
  private readonly retentionDays: number;
  private readonly localRateCounters = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  private retentionTimer?: NodeJS.Timeout;

  constructor(
    @Inject(AI_PROVIDER_TOKEN) private readonly aiProvider: AIProvider,
    private readonly toolRegistry: ToolRegistryService,
    private readonly ragService: RagService,
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly cache?: CacheService,
  ) {
    this.historyLimit = this.config.get<number>('ai.historyLimit') ?? 20;
    this.maxToolIterations =
      this.config.get<number>('ai.maxToolIterations') ?? 5;
    this.rateLimitPerUser =
      this.config.get<number>('ai.rateLimitPerUser') ?? 60;
    this.retentionDays = this.config.get<number>('ai.retentionDays') ?? 90;
  }

  onModuleInit(): void {
    // Keep retention enforcement independent of user traffic. unref() prevents
    // the maintenance timer from keeping CLI/test processes alive.
    this.retentionTimer = setInterval(
      () => {
        void this.purgeExpiredConversationsGlobally();
      },
      24 * 60 * 60 * 1000,
    );
    this.retentionTimer.unref?.();
    void this.purgeExpiredConversationsGlobally();
  }

  onModuleDestroy(): void {
    if (this.retentionTimer) clearInterval(this.retentionTimer);
  }

  private async purgeExpiredConversationsGlobally(): Promise<void> {
    const cutoff = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000,
    );
    try {
      await this.db.aiConversation.deleteMany({
        where: { updatedAt: { lt: cutoff } },
      });
    } catch (error) {
      this.logger.warn(`AI conversation retention cleanup failed: ${error}`);
    }
  }

  private async enforceRateLimit(userId: string): Promise<void> {
    const key = `ai:rate:${userId}`;
    const windowSeconds = 60;
    const count = this.cache
      ? await this.cache.increment(key, windowSeconds)
      : this.incrementLocalCounter(key, windowSeconds);
    if (count !== null && count > this.rateLimitPerUser) {
      throw new HttpException(
        'AI request limit exceeded. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private incrementLocalCounter(key: string, windowSeconds: number): number {
    const now = Date.now();
    const existing = this.localRateCounters.get(key);
    if (!existing || existing.expiresAt <= now) {
      this.localRateCounters.set(key, {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }

  /** Resolve and verify the tenant scope; client-provided hotel IDs never override role assignments. */
  private async resolveHotelScope(
    userId: string,
    role: Role,
    requestedHotelId?: string,
  ): Promise<string | undefined> {
    if (role === Role.MANAGER) {
      const hotel = await this.db.hotel.findFirst({
        where: { managerId: userId },
        select: { id: true },
      });
      if (!hotel) {
        throw new ForbiddenException('No hotel is assigned to this manager');
      }
      if (requestedHotelId && requestedHotelId !== hotel.id) {
        throw new ForbiddenException('You may only access your assigned hotel');
      }
      return hotel.id;
    }

    if (role === Role.STAFF) {
      const assignments = await this.db.staffHotel.findMany({
        where: { staffId: userId },
        select: { hotelId: true },
      });
      const hotelIds = assignments.map((assignment) => assignment.hotelId);
      if (requestedHotelId && !hotelIds.includes(requestedHotelId)) {
        throw new ForbiddenException('You are not assigned to this hotel');
      }
      if (requestedHotelId) return requestedHotelId;
      if (hotelIds.length === 1) return hotelIds[0];
      if (hotelIds.length > 1) {
        throw new ForbiddenException('Select one of your assigned hotels');
      }
      throw new ForbiddenException(
        'No hotel is assigned to this staff account',
      );
    }

    return requestedHotelId;
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    const { userId, role, message } = options;
    await this.enforceRateLimit(userId);
    const authorizedHotelId = await this.resolveHotelScope(
      userId,
      role,
      options.hotelId,
    );

    // AI-004 — Conversation Ownership Scoping
    let conversation: { id: string; userId: string; hotelId: string | null };
    if (options.conversationId) {
      const found = await this.db.aiConversation.findUnique({
        where: { id: options.conversationId },
      });
      if (!found) {
        throw new NotFoundException('Conversation not found');
      }
      if (found.userId !== userId) {
        // Mismatch triggers 403 Forbidden per AI-004
        throw new ForbiddenException(
          'You do not have permission to access this conversation',
        );
      }
      if (
        (role === Role.MANAGER || role === Role.STAFF) &&
        found.hotelId !== authorizedHotelId
      ) {
        throw new ForbiddenException(
          'This conversation is outside your hotel scope',
        );
      }
      conversation = found;
    } else {
      conversation = await this.db.aiConversation.create({
        data: {
          userId,
          hotelId: authorizedHotelId || null,
          title: message.trim().slice(0, 50),
        },
      });
    }

    const contextHotelId =
      authorizedHotelId || conversation.hotelId || undefined;
    const toolContext: AIToolContext = {
      callerId: userId,
      callerRole: role,
      callerHotelId: contextHotelId,
    };

    // AI-005 — Bounded Conversation History
    const pastDbMessages = await this.db.aiMessage.findMany({
      where: { conversationId: conversation.id },
      take: this.historyLimit,
      orderBy: { createdAt: 'asc' },
    });

    const conversationHistory: AIMessage[] = pastDbMessages.map((m) => ({
      role: m.role as any,
      content: m.content,
      toolCalls: (m.toolCalls as any) || undefined,
      toolResults: (m.toolResults as any) || undefined,
    }));

    // AI-015, AI-016, AI-017 — RAG Reference Material
    const ragContext = await this.ragService.retrieveContext(
      message,
      contextHotelId,
    );

    const systemInstruction = `You are the LuxStay AI Assistant.
You are helping a verified user with role: ${role}.
Hotel Scope: ${contextHotelId ? `Hotel ID ${contextHotelId}` : 'None'}.
Always be polite, concise, and helpful. Use provided tools whenever accurate data is needed.
Always answer in the same language the user wrote or spoke in (the UI language is ${options.language || 'unknown'}).${options.language === 'am' ? ' When the user writes or speaks Amharic, reply entirely in Amharic (አማርኛ).' : ''}
${ragContext}`;

    // AI-009 through AI-012: Tools exposed strictly according to caller's role
    const allowedToolDefs = this.toolRegistry.getAllowedToolDefinitions(role);

    // Save incoming user message to database
    await this.db.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      },
    });

    const toolCallsExecuted: string[] = [];
    const placeCards: ChatPlaceCard[] = [];
    let currentTurnMessage = message;
    let finalAssistantText = '';
    let iterations = 0;

    // AI-021 — Tool Iteration Cap
    while (iterations < this.maxToolIterations) {
      iterations++;

      let providerOutput;
      try {
        // AI-001: provider abstraction call
        providerOutput = await this.aiProvider.generateResponse({
          systemInstruction,
          history: conversationHistory,
          message: currentTurnMessage,
          tools: allowedToolDefs,
        });
      } catch (err: any) {
        // AI-023 — AI Provider Failure Handling
        this.logger.error(
          `AI Provider error during turn ${iterations}: ${err.message}`,
          err.stack,
        );
        return {
          conversationId: conversation.id,
          message:
            'I apologize, but our AI assistant service is temporarily experiencing difficulties. Please try again shortly.',
          toolCallsExecuted,
          placeCards: placeCards.slice(0, 6),
        };
      }

      // If the provider returned text without tool calls, we are finished
      if (!providerOutput.toolCalls || providerOutput.toolCalls.length === 0) {
        finalAssistantText =
          providerOutput.text ||
          'How else can I assist you with your hotel experience?';
        break;
      }

      // Execute tool calls
      const currentToolCalls: AIToolCall[] = providerOutput.toolCalls;
      const currentToolResults: AIToolResult[] = [];

      for (const call of currentToolCalls) {
        toolCallsExecuted.push(call.name);
        this.logger.log(
          `Executing tool: ${call.name} for user ${userId} (role: ${role})`,
        );

        // AI-007: Tool enforces own authorization using toolContext (verified caller identity)
        const execOutcome = await this.toolRegistry.executeTool(
          call.name,
          call.args,
          toolContext,
        );

        currentToolResults.push({
          toolCallId: call.id,
          name: call.name,
          result: execOutcome.isError ? execOutcome.error : execOutcome.result,
          isError: execOutcome.isError,
        });

        if (call.name === 'getNearbyPlaces' && !execOutcome.isError && execOutcome.result && typeof execOutcome.result === 'object') {
          const candidate = execOutcome.result as { places?: unknown };
          if (Array.isArray(candidate.places)) {
            for (const place of candidate.places) {
              if (!place || typeof place !== 'object') continue;
              const item = place as Record<string, unknown>;
              if (typeof item.id !== 'string' || typeof item.name !== 'string') continue;
              placeCards.push({
                id: item.id,
                name: item.name,
                category: typeof item.category === 'string' ? item.category : undefined,
                distanceKm: typeof item.distanceKm === 'number' ? item.distanceKm : undefined,
                images: Array.isArray(item.images) ? item.images : undefined,
                verifiedSource: item.verifiedSource && typeof item.verifiedSource === 'object'
                  ? item.verifiedSource as ChatPlaceCard['verifiedSource']
                  : null,
                lastVerifiedAt: typeof item.lastVerifiedAt === 'string' || item.lastVerifiedAt instanceof Date ? item.lastVerifiedAt : null,
              });
            }
          }
        }
      }

      // Gemini requires a function-call turn to immediately follow the user
      // turn that triggered it. That user row is persisted above but never
      // added to the in-memory history, so seed it once before the tool turns.
      if (iterations === 1) {
        conversationHistory.push({ role: 'user', content: message });
      }

      // Append assistant call & tool response to memory history for next iteration
      conversationHistory.push({
        role: 'assistant',
        content: providerOutput.text || '',
        toolCalls: currentToolCalls,
      });

      conversationHistory.push({
        role: 'tool',
        content: JSON.stringify(currentToolResults),
        toolResults: currentToolResults,
      });

      // Persist the tool call / result interaction
      await this.db.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: providerOutput.text || '',
          toolCalls: currentToolCalls as any,
          toolResults: currentToolResults as any,
        },
      });

      // Prepare next prompt state
      // The results travel as a functionResponse turn built by the provider,
      // so there is no separate user message for the next iteration.
      currentTurnMessage = '';
    }

    if (!finalAssistantText && iterations >= this.maxToolIterations) {
      finalAssistantText =
        'I was unable to complete all required tool operations within the allowed processing limits. Please try asking a more specific question.';
    }

    // Persist final assistant response
    await this.db.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: finalAssistantText,
      },
    });

    await this.db.aiConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return {
      conversationId: conversation.id,
      message: finalAssistantText,
      toolCallsExecuted,
      placeCards: placeCards.slice(0, 6),
    };
  }

  // AI-019 & AI-020 — Voice Runs Through the Same Pipeline as Text
  async voice(options: VoiceOptions): Promise<VoiceResult> {
    const {
      userId,
      role,
      hotelId,
      audioBuffer,
      mimeType,
      conversationId,
      language,
    } = options;

    let transcript = '';
    try {
      transcript = await this.aiProvider.transcribeAudio(
        audioBuffer,
        mimeType,
        language,
      );
    } catch (err: any) {
      this.logger.error(`Transcription error: ${err.message}`);
      throw new Error('Unable to transcribe voice audio input');
    }

    // Transcribed text runs through the identical chat() pipeline
    const chatResult = await this.chat({
      userId,
      role,
      hotelId,
      message: transcript || 'Hello',
      conversationId,
      language,
    });

    let audioBase64: string | undefined;
    try {
      const speechBuffer = await this.aiProvider.synthesizeSpeech(
        chatResult.message,
      );
      audioBase64 = speechBuffer.toString('base64');
    } catch (err: any) {
      this.logger.warn(`Speech synthesis error: ${err.message}`);
      // Degradation: voice still succeeds with text if TTS fails
    }

    return {
      ...chatResult,
      transcript,
      audioBase64,
    };
  }

  // AI-025 — Conversation History Management & Export
  private async purgeExpiredConversations(userId: string): Promise<void> {
    const cutoff = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000,
    );
    await this.db.aiConversation.deleteMany({
      where: { userId, updatedAt: { lt: cutoff } },
    });
  }

  async listUserConversations(userId: string) {
    await this.purgeExpiredConversations(userId);
    const list = await this.db.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, role: true },
        },
      },
    });

    return list.map((c) => ({
      id: c.id,
      title: c.title,
      hotelId: c.hotelId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      lastMessage: c.messages[0]?.content || null,
    }));
  }

  async exportUserConversations(userId: string) {
    await this.purgeExpiredConversations(userId);
    const conversations = await this.db.aiConversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      hotelId: conversation.hotelId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls,
        toolResults: message.toolResults,
        createdAt: message.createdAt.toISOString(),
      })),
    }));
  }

  async getConversation(
    conversationId: string,
    userId: string,
    role?: Role,
    requestedHotelId?: string,
  ) {
    const conversation = await this.db.aiConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // AI-004: Ownership check
    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }
    if (role === Role.MANAGER || role === Role.STAFF) {
      const authorizedHotelId = await this.resolveHotelScope(
        userId,
        role,
        requestedHotelId,
      );
      if (conversation.hotelId !== authorizedHotelId) {
        throw new ForbiddenException(
          'This conversation is outside your hotel scope',
        );
      }
    }

    return {
      id: conversation.id,
      title: conversation.title,
      hotelId: conversation.hotelId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
    role?: Role,
    requestedHotelId?: string,
  ) {
    const conversation = await this.db.aiConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // AI-004: Ownership check
    if (conversation.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }
    if (role === Role.MANAGER || role === Role.STAFF) {
      const authorizedHotelId = await this.resolveHotelScope(
        userId,
        role,
        requestedHotelId,
      );
      if (conversation.hotelId !== authorizedHotelId) {
        throw new ForbiddenException(
          'This conversation is outside your hotel scope',
        );
      }
    }

    await this.db.aiConversation.delete({
      where: { id: conversationId },
    });

    return { success: true };
  }
}
