import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { providerRefFor, simulateProviderLatency } from './provider-ref';
import { OtpService } from '../../application/otp.service';
import { MockSmsService } from '../mock-sms.service';
import { BankMockProvider } from './bank-mock.provider';
import { PrismaService } from '../../../../prisma/prisma.service';

const SUPPORTED_METHODS = [
  'TELEBIRR',
  'CBE_BIRR',
  'AWASH_BANK',
  'ENAT_BANK',
  'AMHARA_BANK',
  'COOP_BANK',
] as const;

const METHOD_TO_BANK: Record<string, string> = {
  CBE_BIRR: 'CBE',
  AWASH_BANK: 'AWASH',
  ENAT_BANK: 'ENAT',
  AMHARA_BANK: 'AMHARA',
  COOP_BANK: 'COOP',
};

@Injectable()
export class ChapaMockProvider {
  readonly name = 'CHAPA';
  private readonly logger = new Logger(ChapaMockProvider.name);

  constructor(
    private readonly bank: BankMockProvider,
    private readonly otpService: OtpService,
    private readonly sms: MockSmsService,
    private readonly db: PrismaService,
  ) {}

  /**
   * Generate a Chapa-style tx_ref.
   */
  generateTxRef(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `CHP-YT-${date}-${rand}`;
  }

  /**
   * Initialize a Telebirr payment with OTP flow.
   */
  async initializeTelebirr(
    paymentId: string,
    txRef: string,
    amount: number,
    phone: string,
  ): Promise<{ status: 'OTP_SENT'; expiresAt: Date }> {
    const { code, expiresAt } = await this.otpService.generateOtp(paymentId);

    // Send mock SMS
    const message = [
      'LuxStay Payment',
      '',
      'Your payment verification code is:',
      code,
      '',
      `Amount: ETB ${amount.toLocaleString()}`,
      'Merchant: LuxStay',
      `Reference: ${txRef}`,
      '',
      'Expires in 5 minutes.',
    ].join('\n');

    this.sms.send(phone, message);

    this.logger.log({
      message: 'Telebirr OTP sent',
      paymentId,
      txRef,
      phone: this.maskPhone(phone),
    });

    return { status: 'OTP_SENT', expiresAt };
  }

  /**
   * Generate a CBE-style payment reference.
   */
  generateBankReference(bankCode: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${bankCode}-CHAPA-${date}-${rand}`;
  }

  /**
   * Initialize a bank payment.
   */
  async initializeBank(
    paymentId: string,
    txRef: string,
    amount: number,
    bankCode: string,
    accountNumber: string,
  ): Promise<{ status: 'PROCESSING'; bankTransactionId: string; paymentReference: string }> {
    const bankTransactionId = `BANK-MOCK-${Date.now().toString(36).toUpperCase()}`;
    const paymentReference = this.generateBankReference(bankCode);

    await this.db.payment.update({
      where: { id: paymentId },
      data: {
        status: 'PROCESSING',
        bankCode,
        transactionId: bankTransactionId,
        metadata: { paymentReference },
      },
    });

    await this.db.paymentEvent.create({
      data: {
        paymentId,
        eventType: 'BANK_INITIALIZED',
        status: 'PROCESSING',
        payload: {
          bankCode,
          accountNumber: this.maskAccount(accountNumber),
          bankTransactionId,
          paymentReference,
        },
      },
    });

    this.logger.log({
      message: 'Bank payment initialized',
      paymentId,
      txRef,
      bankCode,
      bankTransactionId,
      paymentReference,
    });

    return { status: 'PROCESSING', bankTransactionId, paymentReference };
  }

  /**
   * Handle bank authorization callback.
   */
  async handleBankAuthorization(
    paymentId: string,
    bankCode: string,
    accountNumber: string,
    amount: number,
    outcome: 'AUTHORIZED' | 'DECLINED' | 'INSUFFICIENT_BALANCE' | 'TIMEOUT',
  ): Promise<{
    approved: boolean;
    status: 'COMPLETED' | 'FAILED';
    failureReason?: string;
  }> {
    const result = await this.bank.simulateAuth(
      bankCode,
      accountNumber,
      amount,
      outcome,
    );

    await this.db.paymentEvent.create({
      data: {
        paymentId,
        eventType: 'BANK_AUTH_RESULT',
        status: result.status,
        payload: {
          bankCode,
          outcome,
          bankTransactionId: result.bankTransactionId,
          failureReason: result.failureReason,
        },
      },
    });

    return result;
  }

  /**
   * Check if a method is supported by Chapa.
   */
  isSupportedMethod(method: string): boolean {
    return SUPPORTED_METHODS.includes(
      method as (typeof SUPPORTED_METHODS)[number],
    );
  }

  /**
   * Get the bank code for a payment method.
   */
  getBankCode(method: string): string | undefined {
    return METHOD_TO_BANK[method];
  }

  private maskPhone(phone: string): string {
    if (phone.length < 6) return '***';
    return phone.slice(0, 4) + '***' + phone.slice(-2);
  }

  private maskAccount(account: string): string {
    if (account.length < 4) return '****';
    return '****' + account.slice(-4);
  }
}
