export type { Notification } from '../../../generated/prisma/client';

export const NOTIFICATION_TYPES = {
  REGISTRATION: 'registration',
  BOOKING_CREATED: 'booking_created',
  BOOKING_CONFIRMATION: 'booking_confirmation',
  BOOKING_CANCELLATION: 'booking_cancellation',
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_REFUNDED: 'payment_refunded',
  CHECK_IN_REMINDER: 'check_in_reminder',
} as const;

export const NOTIFICATION_CHANNELS = {
  EMAIL: 'EMAIL',
  PUSH: 'PUSH',
} as const;
