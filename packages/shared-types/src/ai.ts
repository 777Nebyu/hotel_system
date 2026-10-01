import { z } from 'zod';

export const aiMessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export type AiMessageRole = z.infer<typeof aiMessageRoleSchema>;

/** UI languages the assistant must understand and reply in. */
export const aiLanguageSchema = z.enum(['en', 'am']);
export type AiLanguage = z.infer<typeof aiLanguageSchema>;

export const aiChatInputSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(4000, 'Message cannot exceed 4000 characters'),
  conversationId: z.string().optional(),
  hotelId: z.string().optional(),
  language: aiLanguageSchema.optional(),
});
export type AiChatInput = z.infer<typeof aiChatInputSchema>;

export const aiVoiceInputSchema = z.object({
  audioBase64: z.string().min(1, 'Audio data is required').max(8_000_000, 'Audio data is too large'),
  mimeType: z.string().default('audio/wav'),
  conversationId: z.string().optional(),
  hotelId: z.string().optional(),
  language: aiLanguageSchema.optional(),
});
export type AiVoiceInput = z.infer<typeof aiVoiceInputSchema>;

export interface AiMessageDto {
  id?: string;
  role: AiMessageRole;
  content: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
  createdAt?: string;
}

export interface AiChatResponse {
  conversationId: string;
  message: string;
  toolCallsExecuted: string[];
}

export interface AiVoiceResponse {
  conversationId: string;
  transcript: string;
  message: string;
  audioBase64?: string;
}

export interface AiConversationSummary {
  id: string;
  title: string | null;
  hotelId: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
}
