import { Injectable, Logger } from '@nestjs/common';
import type {
  IPaymentGateway,
  InitializePaymentParams,
  InitializePaymentResult,
  VerifyPaymentResult,
} from '../../domain/payment-gateway.interface';
import { ChapaService } from '../chapa/chapa.service';

@Injectable()
export class ChapaPaymentGateway implements IPaymentGateway {
  readonly providerName = 'CHAPA';
  private readonly logger = new Logger(ChapaPaymentGateway.name);

  constructor(private readonly chapaService: ChapaService) {}

  async initializePayment(
    params: InitializePaymentParams,
  ): Promise<InitializePaymentResult> {
    const names = (params.firstName || 'Guest User').split(' ');
    const firstName = names[0] || 'Guest';
    const lastName = names.slice(1).join(' ') || params.lastName || 'User';

    const res = await this.chapaService.initialize({
      amount: params.amount,
      currency: params.currency || 'ETB',
      email: params.email,
      first_name: firstName,
      last_name: lastName,
      phone_number: params.phone,
      tx_ref: params.txRef,
      callback_url: params.callbackUrl,
      return_url: params.returnUrl,
      customization: params.customization,
    });

    this.logger.log({
      message: 'Chapa hosted payment initialized',
      txRef: params.txRef,
      checkoutUrl: res.data?.checkout_url,
    });

    return {
      status: 'PENDING',
      checkoutUrl: res.data?.checkout_url,
      providerRef: params.txRef,
      raw: res,
    };
  }

  async verifyPayment(txRef: string): Promise<VerifyPaymentResult> {
    const res = await this.chapaService.verify(txRef);
    const data = res.data;

    let status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'CANCELLED' = 'PENDING';
    if (data?.status === 'success') {
      status = 'SUCCEEDED';
    } else if (data?.status === 'failed') {
      status = 'FAILED';
    } else if (data?.status === 'cancelled') {
      status = 'CANCELLED';
    }

    return {
      status,
      amount: Number(data?.amount ?? 0),
      currency: data?.currency ?? 'ETB',
      txRef: data?.tx_ref ?? txRef,
      reference: data?.reference,
      raw: res,
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    return this.chapaService.verifySignature(rawBody, signature);
  }
}
