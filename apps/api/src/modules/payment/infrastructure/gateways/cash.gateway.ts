import { PaymentGateway } from '../../domain';
import { providerRefFor } from './provider-ref';

export class CashGateway implements PaymentGateway {
  readonly method = 'CASH' as const;

  async charge(input: { amount: number; reference: string }) {
    return {
      approved: true,
      providerRef: providerRefFor('cash', input.reference),
    };
  }
}