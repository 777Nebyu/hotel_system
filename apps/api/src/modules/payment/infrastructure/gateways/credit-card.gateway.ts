import { PaymentAdapter } from '../../domain';
import { providerRefFor, simulateProviderLatency } from './provider-ref';

/** Deterministic mock: card 4242...announces approval, 4000...announces decline. */
export class CreditCardGateway implements PaymentAdapter {
  readonly method = 'CREDIT_CARD' as const;

  async initiate(
    booking: { id: string; totalPrice: number; currency: string },
    amount: number,
    currency: string,
    reference?: string,
  ) {
    await simulateProviderLatency();
    return {
      providerRef: providerRefFor('credit_card', reference ?? booking.id),
    };
  }

  async confirm(providerRef: string, reference?: string) {
    await simulateProviderLatency();
    const card = (reference ?? providerRef).replace(/[\s-]/g, '');
    const approved =
      card === '4242424242424242' ||
      card === '4917484589897108' ||
      card === '4716293094400436' ||
      card.includes('4242424242424242') ||
      card.includes('4917484589897108') ||
      card.includes('4716293094400436');
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
      providerRefFor('credit_card', input.reference),
      input.reference,
    );
    return {
      approved: res.approved,
      providerRef: providerRefFor('credit_card', input.reference),
    };
  }
}
