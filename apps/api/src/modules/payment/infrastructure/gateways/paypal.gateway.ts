import { PaymentGateway } from '../../domain';
import { providerRefFor, simulateProviderLatency } from './provider-ref';

export class PayPalGateway implements PaymentGateway {
  readonly method = 'PAYPAL' as const;

  async charge(input: { amount: number; reference: string }) {
    await simulateProviderLatency();
    const email = input.reference.toLowerCase();
    const approved = email === 'approved@paypal.test';
    return {
      approved,
      providerRef: providerRefFor('paypal', input.reference),
    };
  }
}
