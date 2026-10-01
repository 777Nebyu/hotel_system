import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../../generated/prisma/client';
import { AIService } from '../application/ai.service';
import { AiChatDto, AiVoiceDto, ConversationIdParamsDto } from './dto/ai.dto';

interface AuthedRequest {
  user: {
    sub: string;
    role: Role;
    hotelId?: string;
  };
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  // AI-003, AI-022: Single backend gateway for chat with per-user rate limiting
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a message to the AI assistant gateway' })
  async chat(@Body() dto: AiChatDto, @Req() req: AuthedRequest) {
    return this.aiService.chat({
      userId: req.user.sub,
      role: req.user.role,
      hotelId: dto.hotelId || req.user.hotelId,
      message: dto.message,
      conversationId: dto.conversationId,
      language: dto.language,
    });
  }

  // AI-003, AI-019, AI-020, AI-022: Voice runs through the same pipeline, secrets stay server-side
  @Post('voice')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Process voice input and receive synthesized response',
  })
  async voice(@Body() dto: AiVoiceDto, @Req() req: AuthedRequest) {
    const audioBuffer = Buffer.from(dto.audioBase64, 'base64');
    return this.aiService.voice({
      userId: req.user.sub,
      role: req.user.role,
      hotelId: dto.hotelId || req.user.hotelId,
      audioBuffer,
      mimeType: dto.mimeType || 'audio/wav',
      conversationId: dto.conversationId,
      language: dto.language,
    });
  }

  // AI-025: List conversations
  @Get('conversations')
  @ApiOperation({ summary: 'List user AI conversation sessions' })
  async listConversations(@Req() req: AuthedRequest) {
    return this.aiService.listUserConversations(req.user.sub);
  }

  // AI-025: Export owned conversation history after retention cleanup
  @Get('conversations/export')
  @ApiOperation({ summary: 'Export your AI conversation history' })
  async exportConversations(@Req() req: AuthedRequest) {
    return this.aiService.exportUserConversations(req.user.sub);
  }

  // AI-004, AI-025: Get single conversation with ownership validation
  @Get('conversations/:id')
  @ApiOperation({ summary: 'Retrieve conversation history by ID' })
  async getConversation(
    @Param() params: ConversationIdParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.aiService.getConversation(
      params.id,
      req.user.sub,
      req.user.role,
      req.user.hotelId,
    );
  }

  // AI-004, AI-025: Delete conversation
  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete conversation history' })
  async deleteConversation(
    @Param() params: ConversationIdParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.aiService.deleteConversation(
      params.id,
      req.user.sub,
      req.user.role,
      req.user.hotelId,
    );
  }
}
