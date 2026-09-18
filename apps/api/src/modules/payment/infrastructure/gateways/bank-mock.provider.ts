import { Injectable, Logger } from '@nestjs/common';
import { PaymentAdapter } from '../../domain';
import { providerRefFor, simulateProviderLatency } from './provider-ref';

export interface BankDemoAccount {
  accountNumber: string;
  bankCode: string;
  balance: number;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  holderName: string;
}

const DEMO_ACCOUNTS: BankDemoAccount[] = [
  {
    accountNumber: '100000',
    bankCode: 'CBE',
    balance: 50000,
    status: 'ACTIVE',
    holderName: 'Demo Customer',
  },
  {
    accountNumber: '200000',
    bankCode: 'CBE',
    balance: 500,
    status: 'ACTIVE',
    holderName: 'Low Balance Demo',
  },
  {
    accountNumber: '300000',
    bankCode: 'AWASH',
    balance: 25000,
    status: 'ACTIVE',
    holderName: 'Awash Demo',
  },
  {
    accountNumber: '400000',
    bankCode: 'ENAT',
    balance: 15000,
    status: 'ACTIVE',
    holderName: 'Enat Demo',
  },
  {
    accountNumber: '500000',
    bankCode: 'AMHARA',
    balance: 30000,
    status: 'ACTIVE',
    holderName: 'Amhara Demo',
  },
  {
    accountNumber: '600000',
    bankCode: 'COOP',
    balance: 20000,
    status: 'ACTIVE',
    holderName: 'COOP Demo',
  },
  // Frozen account for testing
  {
    accountNumber: '700000',
    bankCode: 'CBE',
    balance: 10000,
    status: 'FROZEN',
    holderName: 'Frozen Account',
  },
];

const BANK_NAMES: Record<string, string> = {
  CBE: 'Commercial Bank of Ethiopia',
  AWASH: 'Awash Bank',
  ENAT: 'Enat Bank',
  AMHARA: 'Amhara Bank',
  COOP: 'Cooperative Bank of Ethiopia',
};

@Injectable()
export class BankMockProvider implements PaymentAdapter {
  readonly method = 'CBE_BIRR' as const;
  private readonly logger = new Logger(BankMockProvider.name);

  /** Get demo accounts for a bank code */
  getDemoAccounts(bankCode: string): BankDemoAccount[] {
    return DEMO_ACCOUNTS.filter((a) => a.bankCode === bankCode);
  }

  /** Get all supported bank codes */
  getSupportedBanks(): string[] {
    return ['CBE', 'AWASH', 'ENAT', 'AMHARA', 'COOP'];
  }

  /** Get bank display name */
  getBankName(bankCode: string): string {
    return BANK_NAMES[bankCode] ?? bankCode;
  }

  async initiate(
    booking: { id: string; totalPrice: number; currency: string },
    amount: number,
    currency: string,
    reference?: string,
  ) {
    await simulateProviderLatency();
    const bankCode = reference?.includes(':') ? reference.split(':')[0] : 'CBE';
    return {
      providerRef: providerRefFor(`bank_${bankCode.toLowerCase()}`, booking.id),
    };
  }

  async confirm(providerRef: string, reference?: string) {
    await simulateProviderLatency();

    // Extract bank code from providerRef or reference
    const bankCode = this.extractBankCode(providerRef, reference);

    // Parse reference format: "CBE:100000" or just "100000"
    const accountNumber = reference?.includes(':')
      ? reference.split(':')[1]
      : reference;

    // Default to account 100000 if no reference provided
    const account = this.findAccount(accountNumber ?? '100000', bankCode);

    if (!account) {
      this.logger.warn({
        message: 'Bank account not found',
        providerRef,
        accountNumber,
        bankCode,
      });
      return { approved: false, status: 'FAILED' as const };
    }

    if (account.status === 'FROZEN') {
      this.logger.warn({
        message: 'Bank account frozen',
        providerRef,
        accountNumber: account.accountNumber,
      });
      return { approved: false, status: 'FAILED' as const };
    }

    if (account.status === 'CLOSED') {
      this.logger.warn({
        message: 'Bank account closed',
        providerRef,
        accountNumber: account.accountNumber,
      });
      return { approved: false, status: 'FAILED' as const };
    }

    // Check balance
    const amount = this.extractAmount(providerRef);
    if (amount && account.balance < amount) {
      this.logger.warn({
        message: 'Insufficient balance',
        providerRef,
        accountNumber: account.accountNumber,
        balance: account.balance,
        requested: amount,
      });
      return { approved: false, status: 'FAILED' as const };
    }

    return { approved: true, status: 'COMPLETED' as const };
  }

  async refund(providerRef: string, amount: number) {
    await simulateProviderLatency();
    return {
      success: true,
      refundRef: `bank_refund_${providerRef}_${Date.now().toString(36)}`,
    };
  }

  /** Simulate bank authorization with specific outcome */
  async simulateAuth(
    bankCode: string,
    accountNumber: string,
    amount: number,
    outcome: 'AUTHORIZED' | 'DECLINED' | 'INSUFFICIENT_BALANCE' | 'TIMEOUT',
  ): Promise<{
    approved: boolean;
    status: 'COMPLETED' | 'FAILED';
    bankTransactionId?: string;
    failureReason?: string;
  }> {
    await simulateProviderLatency();

    const bankTransactionId = `BANK-MOCK-${Date.now().toString(36).toUpperCase()}`;

    switch (outcome) {
      case 'AUTHORIZED':
        return {
          approved: true,
          status: 'COMPLETED',
          bankTransactionId,
        };
      case 'DECLINED':
        return {
          approved: false,
          status: 'FAILED',
          bankTransactionId,
          failureReason: 'Payment declined by bank',
        };
      case 'INSUFFICIENT_BALANCE':
        return {
          approved: false,
          status: 'FAILED',
          bankTransactionId,
          failureReason: 'Insufficient balance',
        };
      case 'TIMEOUT':
        return {
          approved: false,
          status: 'FAILED',
          failureReason: 'Bank request timed out',
        };
    }
  }

  private findAccount(
    accountNumber: string,
    bankCode?: string,
  ): BankDemoAccount | undefined {
    return DEMO_ACCOUNTS.find(
      (a) =>
        a.accountNumber === accountNumber &&
        (!bankCode || a.bankCode === bankCode),
    );
  }

  private extractBankCode(providerRef: string, reference?: string): string {
    if (reference?.includes(':')) return reference.split(':')[0];
    if (providerRef.includes('bank_')) {
      const match = providerRef.match(/bank_(\w+)_/);
      if (match) return match[1].toUpperCase();
    }
    return 'CBE';
  }

  private extractAmount(providerRef: string): number | null {
    // Try to extract amount from metadata if available
    return null;
  }
}
