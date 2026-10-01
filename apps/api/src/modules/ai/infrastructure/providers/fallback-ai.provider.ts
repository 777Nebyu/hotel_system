import { Logger } from '@nestjs/common';
import { AIProvider } from './ai-provider.interface';
import {
  AIProviderChatInput,
  AIProviderChatOutput,
} from '../../domain/ai.types';

/**
 * AI-001 — this is itself an AIProvider, so the abstraction holds and no
 * business logic, controller or frontend changes with it.
 * AI-023 — a primary-provider failure is absorbed here and served from the
 * fallback; when no fallback is configured (or it fails too) the error
 * propagates so AIService.chat() keeps returning the generic apology.
 */
export class FallbackAIProvider implements AIProvider {
  private readonly logger = new Logger(FallbackAIProvider.name);

  constructor(
    private readonly primary: AIProvider,
    private readonly fallback: AIProvider,
    private readonly fallbackName: string,
  ) {}

  private report(scope: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(
      `Primary AI provider failed during ${scope}: ${message} — serving from fallback (${this.fallbackName})`,
    );
  }

  async generateResponse(
    input: AIProviderChatInput,
  ): Promise<AIProviderChatOutput> {
    try {
      return await this.primary.generateResponse(input);
    } catch (err) {
      this.report('generateResponse', err);
      return this.fallback.generateResponse(input);
    }
  }

  async transcribeAudio(
    audio: Buffer,
    mimeType: string,
    language?: string,
  ): Promise<string> {
    try {
      return await this.primary.transcribeAudio(audio, mimeType, language);
    } catch (err) {
      this.report('transcribeAudio', err);
      return this.fallback.transcribeAudio(audio, mimeType, language);
    }
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    try {
      return await this.primary.synthesizeSpeech(text);
    } catch (err) {
      this.report('synthesizeSpeech', err);
      return this.fallback.synthesizeSpeech(text);
    }
  }
}
