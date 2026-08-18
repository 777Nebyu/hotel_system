import { PaymentGateway } from '../../domain';
import { providerRefFor } from './provider-ref';

export class CbeBirrGateway implements PaymentGateway {
  readonly method = 'CBE_BIRR' as const;

  async charge(input: { amount: number; reference: string }) {
    const phone = input.reference.replace(/[\s-]/g, '');
    const approved = phone === '+251911000002' || phone === '0911000002';
    return {
      approved,
      providerRef: providerRefFor('cbe_birr', input.reference),
    };
  }
}