import { createZodDto } from 'nestjs-zod';
import {
  notificationIdParamsSchema,
  notificationsQuerySchema,
  registerPushTokenSchema,
  updateNotificationPreferenceSchema,
} from '@repo/shared-types';

export class NotificationIdParamsDto extends createZodDto(
  notificationIdParamsSchema,
) {}
export class NotificationsQueryDto extends createZodDto(
  notificationsQuerySchema,
) {}
export class UpdateNotificationPreferenceDto extends createZodDto(
  updateNotificationPreferenceSchema,
) {}
export class RegisterPushTokenDto extends createZodDto(
  registerPushTokenSchema,
) {}
