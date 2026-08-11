export const BookingEventNames = {
  CREATED: 'booking.created',
  CANCELLED: 'booking.cancelled',
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
