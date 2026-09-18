import { PaymentAdapter } from '../../domain';
import { providerRefFor, simulateProviderLatency } from './provider-ref';

export class CbeBirrGateway implements PaymentAdapter {
  readonly method = 'CBE_BIRR' as const;

  async initiate(
    booking: { id: string; totalPrice: number; currency: string },
    amount: number,
    currency: string,
    reference?: string,
  ) {
    await simulateProviderLatency();
    return {
      providerRef: providerRefFor('cbe_birr', reference ?? booking.id),
    };
  }

  async confirm(providerRef: string, reference?: string) {
    await simulateProviderLatency();
    const phone = (reference ?? providerRef).replace(/[\s-]/g, '');
    const approved =
      phone === '+251911000002' ||
      phone === '0911000002' ||
      phone.includes('911000002');
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
      providerRefFor('cbe_birr', input.reference),
      input.reference,
    );
    return {
      approved: res.approved,
      providerRef: providerRefFor('cbe_birr', input.reference),
    };
  }
}
