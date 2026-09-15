import { z } from 'zod';

const id = z.string().min(1);

export const notificationChannelSchema = z.enum(['EMAIL', 'PUSH', 'IN_APP']);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const notificationIdParamsSchema = z.object({ notificationId: id });
export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;

export const updateNotificationPreferenceSchema = z.object({
  type: z.string().min(1).max(64),
  channel: notificationChannelSchema.default('EMAIL'),
  enabled: z.boolean(),
});
export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;

export const registerPushTokenSchema = z.object({
  token: z.string().min(1).max(500),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;