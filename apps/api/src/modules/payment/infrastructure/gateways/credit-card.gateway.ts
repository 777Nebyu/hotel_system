import { PaymentGateway } from '../../domain';
import { providerRefFor } from './provider-ref';

/** Deterministic mock: card 4242...announces approval, 4000...announces decline. */
export class CreditCardGateway implements PaymentGateway {
  readonly method = 'CREDIT_CARD' as const;

  async charge(input: { amount: number; reference: string }) {
    const card = input.reference.replace(/[\s-]/g, '');
    const approved =
      card === '4242424242424242' ||
      card === '4917484589897108' ||
      card === '4716293094400436';
    return {
      approved,
      providerRef: providerRefFor('credit_card', input.reference),
    };
  }
}