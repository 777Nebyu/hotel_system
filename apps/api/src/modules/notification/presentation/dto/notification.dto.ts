import { createZodDto } from 'nestjs-zod';
import {
  notificationIdParamsSchema,
  notificationsQuerySchema,
} from '@repo/shared-types';

export class NotificationIdParamsDto extends createZodDto(
  notificationIdParamsSchema,
) {}
export class NotificationsQueryDto extends createZodDto(
  notificationsQuerySchema,
) {}
