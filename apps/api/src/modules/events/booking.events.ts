export const BookingEventNames = {
  CREATED: 'booking.created',
  CANCELLED: 'booking.cancelled',
  MODIFIED: 'booking.modified',
  CHECKED_IN: 'booking.checked_in',
  CHECKED_OUT: 'booking.checked_out',
  NO_SHOW: 'booking.no_show',
} as const;

export class BookingCreatedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly hotelId: string,
    public readonly totalPrice: number,
  ) {}
}

export class BookingCancelledEvent {
  constructor(
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly hotelId: string,
  ) {}
}

export class BookingModifiedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly hotelId: string,
    public readonly paymentDifference: number,
  ) {}
}

export class BookingCheckedInEvent {
  constructor(
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly hotelId: string,
  ) {}
}

export class BookingCheckedOutEvent {
  constructor(
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly hotelId: string,
  ) {}
}

export class BookingNoShowEvent {
  constructor(
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly hotelId: string,
  ) {}
}
