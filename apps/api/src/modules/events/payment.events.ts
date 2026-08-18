export const PaymentEventNames = {
  COMPLETED: 'payment.completed',
  REFUNDED: 'payment.refunded',
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
