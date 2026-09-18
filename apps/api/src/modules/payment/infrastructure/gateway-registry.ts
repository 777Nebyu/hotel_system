import { PaymentAdapter } from '../domain';

/** Maps a payment method to its concrete gateway adapter. */
export class PaymentGatewayRegistry {
  private readonly gateways = new Map<string, PaymentAdapter>();

  constructor(gateways: PaymentAdapter[]) {
    for (const gateway of gateways) {
      this.gateways.set(gateway.method, gateway);
    }
  }

  get(method: string): PaymentAdapter {
    const gateway = this.gateways.get(method);
    if (!gateway) {
      throw new Error(`No payment gateway registered for method "${method}"`);
    }
    return gateway;
  }
}
