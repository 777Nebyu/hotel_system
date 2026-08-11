export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly fullName: string,
    public readonly verificationToken: string,
  ) {}
}

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
    public readonly reason?: string,
  ) {}
}

export class PaymentCompletedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly amount: number,
    public readonly method: string,
  ) {}
}
