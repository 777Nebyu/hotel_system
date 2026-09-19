export type { Notification } from '../../../generated/prisma/client';

export const NOTIFICATION_TYPES = {
  REGISTRATION: 'registration',
  BOOKING_CREATED: 'booking_created',
  NEW_BOOKING: 'new_booking',
  BOOKING_CONFIRMATION: 'booking_confirmation',
  BOOKING_CANCELLATION: 'booking_cancellation',
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_REFUNDED: 'payment_refunded',
  CHECK_IN_REMINDER: 'check_in_reminder',
  MANAGER_ASSIGNED: 'manager_assigned',
  MANAGER_REMOVED: 'manager_removed',
} as const;

export const NOTIFICATION_CHANNELS = {
  EMAIL: 'EMAIL',
  PUSH: 'PUSH',
  IN_APP: 'IN_APP',
} as const;
