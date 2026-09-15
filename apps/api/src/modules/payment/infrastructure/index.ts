export interface PaymentGateway {
  charge(input: {
    amount: number;
    method: string;
    reference: string;
  }): Promise<{ success: boolean; providerRef: string }>;
}
