import { PaymentAdapter } from '../../domain';
import { providerRefFor, simulateProviderLatency } from './provider-ref';

export class TelebirrGateway implements PaymentAdapter {
  readonly method = 'TELEBIRR' as const;

  async initiate(
    booking: { id: string; totalPrice: number; currency: string },
    amount: number,
    currency: string,
    reference?: string,
  ) {
    await simulateProviderLatency();
    return {
      providerRef: providerRefFor('telebirr', reference ?? booking.id),
    };
  }

  async confirm(providerRef: string, reference?: string) {
    await simulateProviderLatency();
    const phone = (reference ?? providerRef).replace(/[\s-]/g, '');
    const approved =
      phone === '+251911000001' ||
      phone === '0911000001' ||
      phone.includes('911000001');
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
      providerRefFor('telebirr', input.reference),
      input.reference,
    );
    return {
      approved: res.approved,
      providerRef: providerRefFor('telebirr', input.reference),
    };
  }
}
