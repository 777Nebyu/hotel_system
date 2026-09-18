import { PaymentAdapter } from '../../domain';
import { providerRefFor, simulateProviderLatency } from './provider-ref';

export class CashGateway implements PaymentAdapter {
  readonly method = 'CASH' as const;

  async initiate(
    booking: { id: string; totalPrice: number; currency: string },
    amount: number,
    currency: string,
    reference?: string,
  ) {
    await simulateProviderLatency();
    return {
      providerRef: providerRefFor('cash', reference ?? booking.id),
    };
  }

  async confirm(providerRef: string, reference?: string) {
    await simulateProviderLatency();
    return {
      approved: true,
      status: 'COMPLETED' as const,
    };
  }

  async refund(providerRef: string, amount: number) {
    await simulateProviderLatency();
    return {
      success: true,
    };
  }

  async charge(input: { amount: number; reference: string }) {
    return {
      approved: true,
      providerRef: providerRefFor('cash', input.reference),
    };
  }
}
