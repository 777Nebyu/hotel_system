export const PaymentEventNames = {
  COMPLETED: 'payment.completed',
  REFUNDED: 'payment.refunded',
  FAILED: 'payment.failed',
} as const;

export class PaymentCompletedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly method: string,
  ) {}
}

export class PaymentRefundedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly method: string,
  ) {}
}

export class PaymentFailedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly method: string,
    public readonly reason?: string,
  ) {}
}
