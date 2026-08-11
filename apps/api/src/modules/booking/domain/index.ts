import type { BookingStatus } from '../../../generated/prisma/client';

export type { Booking, BookingDetail } from '../../../generated/prisma/client';

export const BOOKING_TRANSITIONS: Record<
  BookingStatus,
  readonly BookingStatus[]
> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['CHECKED_OUT'],
  CHECKED_OUT: [],
  CANCELLED: [],
  REJECTED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}
