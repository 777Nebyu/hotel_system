import {
  AIProviderChatInput,
  AIProviderChatOutput,
} from '../../domain/ai.types';

export const AI_PROVIDER_TOKEN = 'AI_PROVIDER_TOKEN';

export interface AIProvider {
  generateResponse(input: AIProviderChatInput): Promise<AIProviderChatOutput>;
  /** `language` is the UI language of the speaker ('en' | 'am') when the caller knows it. */
  transcribeAudio(
    audio: Buffer,
    mimeType: string,
    language?: string,
  ): Promise<string>;
  synthesizeSpeech(text: string): Promise<Buffer>;
}
