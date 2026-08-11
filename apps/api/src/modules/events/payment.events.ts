export const PaymentEventNames = {
  COMPLETED: 'payment.completed',
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
