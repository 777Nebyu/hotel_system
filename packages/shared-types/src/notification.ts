import { z } from 'zod';

const id = z.string().min(1);

export const notificationIdParamsSchema = z.object({ notificationId: id });
export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;