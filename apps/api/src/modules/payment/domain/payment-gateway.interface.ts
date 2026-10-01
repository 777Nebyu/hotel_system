export interface InitializePaymentParams {
  paymentId: string;
  bookingId: string;
  txRef: string;
  amount: number;
  currency: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  callbackUrl?: string;
  returnUrl?: string;
  customization?: {
    title?: string;
    description?: string;
  };
}

export interface InitializePaymentResult {
  status: 'PENDING' | 'OTP_SENT' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  checkoutUrl?: string;
  providerRef?: string;
  paymentReference?: string;
  raw?: unknown;
}

export interface VerifyPaymentResult {
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'CANCELLED';
  amount: number;
  currency: string;
  txRef: string;
  reference?: string;
  raw?: unknown;
}

export interface IPaymentGateway {
  readonly providerName: string;
  initializePayment(
    params: InitializePaymentParams,
  ): Promise<InitializePaymentResult>;
  verifyPayment(txRef: string): Promise<VerifyPaymentResult>;
  verifyWebhookSignature?(rawBody: string | Buffer, signature: string): boolean;
  refundPayment?(
    providerRef: string,
    amount: number,
  ): Promise<{ success: boolean; refundRef?: string }>;
}
