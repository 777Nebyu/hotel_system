"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiVoiceInputSchema = exports.aiChatInputSchema = exports.aiLanguageSchema = exports.aiMessageRoleSchema = void 0;
const zod_1 = require("zod");
exports.aiMessageRoleSchema = zod_1.z.enum(['user', 'assistant', 'system', 'tool']);
/** UI languages the assistant must understand and reply in. */
exports.aiLanguageSchema = zod_1.z.enum(['en', 'am']);
exports.aiChatInputSchema = zod_1.z.object({
    message: zod_1.z.string().trim().min(1, 'Message is required').max(4000, 'Message cannot exceed 4000 characters'),
    conversationId: zod_1.z.string().optional(),
    hotelId: zod_1.z.string().optional(),
    language: exports.aiLanguageSchema.optional(),
});
exports.aiVoiceInputSchema = zod_1.z.object({
    audioBase64: zod_1.z.string().min(1, 'Audio data is required').max(8_000_000, 'Audio data is too large'),
    mimeType: zod_1.z.string().default('audio/wav'),
    conversationId: zod_1.z.string().optional(),
    hotelId: zod_1.z.string().optional(),
    language: exports.aiLanguageSchema.optional(),
});
