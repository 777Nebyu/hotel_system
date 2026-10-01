import { Role } from '../../../generated/prisma/client';

export type AIProviderRole = 'user' | 'assistant' | 'system' | 'tool';

export interface AIMessage {
  role: AIProviderRole;
  content: string;
  toolCalls?: AIToolCall[];
  toolResults?: AIToolResult[];
}

export interface AIToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  // Thinking models reject a replayed functionCall part unless the signature
  // that travelled with it is echoed back alongside it.
  thoughtSignature?: string;
}

export interface AIToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  isError?: boolean;
}

export interface AIToolPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: string[];
  items?: AIToolPropertySchema;
  properties?: Record<string, AIToolPropertySchema>;
  required?: string[];
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AIToolPropertySchema>;
    required?: string[];
  };
}

export interface AIProviderChatInput {
  systemInstruction: string;
  history: AIMessage[];
  message: string;
  tools?: AIToolDefinition[];
}

export interface AIProviderChatOutput {
  text?: string;
  toolCalls?: AIToolCall[];
}

export interface AIToolContext {
  callerId: string;
  callerRole: Role;
  callerHotelId?: string;
}
