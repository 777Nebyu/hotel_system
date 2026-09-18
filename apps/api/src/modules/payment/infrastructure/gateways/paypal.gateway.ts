import { PaymentAdapter } from '../../domain';
import { providerRefFor, simulateProviderLatency } from './provider-ref';

export class PayPalGateway implements PaymentAdapter {
  readonly method = 'PAYPAL' as const;

  async initiate(
    booking: { id: string; totalPrice: number; currency: string },
    amount: number,
    currency: string,
    reference?: string,
  ) {
    await simulateProviderLatency();
    return {
      providerRef: providerRefFor('paypal', reference ?? booking.id),
    };
  }

  async confirm(providerRef: string, reference?: string) {
    await simulateProviderLatency();
    const email = (reference ?? providerRef).toLowerCase();
    const approved =
      email === 'approved@paypal.test' ||
      email.includes('approved@paypal.test');
    return {
      approved,
      status: approved ? ('COMPLETED' as const) : ('FAILED' as const),
    };
  }

  async refund(providerRef: string, amount: number) {
    await simulateProviderLatency();
    return {
      success: true,
      refundRef: `ref_${providerRef}_${Date.now().toString(36)}`,
    };
  }

  async charge(input: { amount: number; reference: string }) {
    const res = await this.confirm(
      providerRefFor('paypal', input.reference),
      input.reference,
    );
    return {
      approved: res.approved,
      providerRef: providerRefFor('paypal', input.reference),
    };
  }
}
