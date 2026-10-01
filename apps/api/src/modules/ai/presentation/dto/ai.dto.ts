import { createZodDto } from 'nestjs-zod';
import { aiChatInputSchema, aiVoiceInputSchema } from '@repo/shared-types';
import { z } from 'zod';

export class AiChatDto extends createZodDto(aiChatInputSchema) {}
export class AiVoiceDto extends createZodDto(aiVoiceInputSchema) {}

const conversationIdParamsSchema = z.object({
  id: z.string().min(1),
});
export class ConversationIdParamsDto extends createZodDto(
  conversationIdParamsSchema,
) {}
