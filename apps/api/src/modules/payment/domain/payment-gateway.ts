import type { PaymentMethod } from '@repo/shared-types';

export interface PaymentAdapter {
  readonly method: PaymentMethod;
  initiate(
    booking: { id: string; totalPrice: number; currency: string },
    amount: number,
    currency: string,
    reference?: string,
  ): Promise<{ providerRef: string }>;
  confirm(
    providerRef: string,
    reference?: string,
  ): Promise<{ approved: boolean; status: 'COMPLETED' | 'FAILED' }>;
  refund(
    providerRef: string,
    amount: number,
  ): Promise<{ success: boolean; refundRef?: string }>;
}

/** @deprecated Alias for PaymentAdapter */
export type PaymentGateway = PaymentAdapter;
