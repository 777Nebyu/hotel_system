"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPushTokenSchema = exports.updateNotificationPreferenceSchema = exports.notificationsQuerySchema = exports.notificationIdParamsSchema = exports.notificationChannelSchema = void 0;
const zod_1 = require("zod");
const id = zod_1.z.string().min(1);
exports.notificationChannelSchema = zod_1.z.enum(['EMAIL', 'PUSH', 'IN_APP']);
exports.notificationIdParamsSchema = zod_1.z.object({ notificationId: id });
exports.notificationsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.updateNotificationPreferenceSchema = zod_1.z.object({
    type: zod_1.z.string().min(1).max(64),
    channel: exports.notificationChannelSchema.default('EMAIL'),
    enabled: zod_1.z.boolean(),
});
exports.registerPushTokenSchema = zod_1.z.object({
    token: zod_1.z.string().min(1).max(500),
});
