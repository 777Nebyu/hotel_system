import { z } from 'zod';
export declare const aiMessageRoleSchema: z.ZodEnum<["user", "assistant", "system", "tool"]>;
export type AiMessageRole = z.infer<typeof aiMessageRoleSchema>;
/** UI languages the assistant must understand and reply in. */
export declare const aiLanguageSchema: z.ZodEnum<["en", "am"]>;
export type AiLanguage = z.infer<typeof aiLanguageSchema>;
export declare const aiChatInputSchema: z.ZodObject<{
    message: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    hotelId: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodEnum<["en", "am"]>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    hotelId?: string | undefined;
    conversationId?: string | undefined;
    language?: "en" | "am" | undefined;
}, {
    message: string;
    hotelId?: string | undefined;
    conversationId?: string | undefined;
    language?: "en" | "am" | undefined;
}>;
export type AiChatInput = z.infer<typeof aiChatInputSchema>;
export declare const aiVoiceInputSchema: z.ZodObject<{
    audioBase64: z.ZodString;
    mimeType: z.ZodDefault<z.ZodString>;
    conversationId: z.ZodOptional<z.ZodString>;
    hotelId: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodEnum<["en", "am"]>>;
}, "strip", z.ZodTypeAny, {
    audioBase64: string;
    mimeType: string;
    hotelId?: string | undefined;
    conversationId?: string | undefined;
    language?: "en" | "am" | undefined;
}, {
    audioBase64: string;
    hotelId?: string | undefined;
    conversationId?: string | undefined;
    language?: "en" | "am" | undefined;
    mimeType?: string | undefined;
}>;
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
//# sourceMappingURL=ai.d.ts.map