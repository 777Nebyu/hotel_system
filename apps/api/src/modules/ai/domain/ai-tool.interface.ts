import { AIToolContext, AIToolDefinition } from './ai.types';

export interface AITool<TArgs = Record<string, unknown>, TResult = unknown> {
  readonly name: string;
  readonly description: string;
  readonly definition: AIToolDefinition;
  execute(rawArgs: unknown, context: AIToolContext): Promise<TResult>;
}
