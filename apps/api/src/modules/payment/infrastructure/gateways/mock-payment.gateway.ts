import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  IPaymentGateway,
  InitializePaymentParams,
  InitializePaymentResult,
  VerifyPaymentResult,
} from '../../domain/payment-gateway.interface';

@Injectable()
export class MockPaymentGateway implements IPaymentGateway {
  readonly providerName = 'MOCK';
  private readonly logger = new Logger(MockPaymentGateway.name);
  private readonly mockSecret: string;

  constructor(private readonly config: ConfigService) {
    this.mockSecret =
      this.config.get<string>('payment.mockWebhookSecret') ??
      'development-mock-payment-secret';
  }

  async initializePayment(
    params: InitializePaymentParams,
  ): Promise<InitializePaymentResult> {
    this.logger.log({
      message: 'Mock payment initialized',
      txRef: params.txRef,
      bookingId: params.bookingId,
    });

    return {
      status: 'PENDING',
      checkoutUrl: `/payments/mock/${params.bookingId}`,
      providerRef: params.txRef,
    };
  }

  async verifyPayment(txRef: string): Promise<VerifyPaymentResult> {
    this.logger.log({
      message: 'Mock payment verified',
      txRef,
    });

    return {
      status: 'SUCCEEDED',
      amount: 100,
      currency: 'ETB',
      txRef,
      reference: `MOCK-REF-${Date.now()}`,
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature) return false;
    try {
      const expectedHash = createHmac('sha256', this.mockSecret)
        .update(rawBody)
        .digest('hex');
      const expectedBuffer = Buffer.from(expectedHash, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');
      if (expectedBuffer.length !== signatureBuffer.length) return false;
      return timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch {
      return false;
    }
  }

  async refundPayment(
    providerRef: string,
    amount: number,
  ): Promise<{ success: boolean; refundRef?: string }> {
    return {
      success: true,
      refundRef: `MOCK-REFUND-${Date.now()}`,
    };
  }
}
