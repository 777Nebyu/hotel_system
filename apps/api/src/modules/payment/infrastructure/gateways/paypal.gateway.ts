import { PaymentGateway } from '../../domain';
import { providerRefFor } from './provider-ref';

export class PayPalGateway implements PaymentGateway {
  readonly method = 'PAYPAL' as const;

  async charge(input: { amount: number; reference: string }) {
    const email = input.reference.toLowerCase();
    const approved = email === 'approved@paypal.test';
    return {
      approved,
      providerRef: providerRefFor('paypal', input.reference),
    };
  }
}