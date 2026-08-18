import { PaymentGateway } from '../../domain';
import { providerRefFor } from './provider-ref';

export class TelebirrGateway implements PaymentGateway {
  readonly method = 'TELEBIRR' as const;

  async charge(input: { amount: number; reference: string }) {
    const phone = input.reference.replace(/[\s-]/g, '');
    const approved = phone === '+251911000001' || phone === '0911000001';
    return {
      approved,
      providerRef: providerRefFor('telebirr', input.reference),
    };
  }
}