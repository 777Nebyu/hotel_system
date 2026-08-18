import type { PaymentMethod } from '@repo/shared-types';

export interface PaymentGateway {
  readonly method: PaymentMethod;
  charge(input: {
    amount: number;
    reference: string;
  }): Promise<{ approved: boolean; providerRef: string }>;
}