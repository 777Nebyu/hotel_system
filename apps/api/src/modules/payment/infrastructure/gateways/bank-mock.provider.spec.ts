import { BankMockProvider } from './bank-mock.provider';

describe('BankMockProvider', () => {
  let provider: BankMockProvider;

  beforeEach(() => {
    provider = new BankMockProvider();
  });

  describe('getDemoAccounts', () => {
    it('should return CBE demo accounts', () => {
      const accounts = provider.getDemoAccounts('CBE');
      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts.every((a) => a.bankCode === 'CBE')).toBe(true);
    });

    it('should return Awash demo accounts', () => {
      const accounts = provider.getDemoAccounts('AWASH');
      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts[0].bankCode).toBe('AWASH');
    });

    it('should return empty array for unknown bank', () => {
      const accounts = provider.getDemoAccounts('UNKNOWN');
      expect(accounts).toEqual([]);
    });
  });

  describe('getSupportedBanks', () => {
    it('should return 5 banks', () => {
      const banks = provider.getSupportedBanks();
      expect(banks).toEqual(['CBE', 'AWASH', 'ENAT', 'AMHARA', 'COOP']);
      expect(banks.length).toBe(5);
    });
  });

  describe('getBankName', () => {
    it('should return full name for CBE', () => {
      expect(provider.getBankName('CBE')).toBe('Commercial Bank of Ethiopia');
    });

    it('should return full name for Awash', () => {
      expect(provider.getBankName('AWASH')).toBe('Awash Bank');
    });

    it('should return code for unknown bank', () => {
      expect(provider.getBankName('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('initiate', () => {
    it('should return a provider reference', async () => {
      const result = await provider.initiate(
        { id: 'booking-1', totalPrice: 2500, currency: 'ETB' },
        2500,
        'ETB',
      );
      expect(result.providerRef).toBeTruthy();
      expect(typeof result.providerRef).toBe('string');
    });
  });

  describe('confirm', () => {
    it('should approve with default account (100000)', async () => {
      const result = await provider.confirm('provider-ref', '100000');
      expect(result.approved).toBe(true);
      expect(result.status).toBe('COMPLETED');
    });

    it('should approve with bank:account format', async () => {
      const result = await provider.confirm('provider-ref', 'CBE:100000');
      expect(result.approved).toBe(true);
    });

    it('should fail for non-existent account', async () => {
      const result = await provider.confirm('provider-ref', '999999');
      expect(result.approved).toBe(false);
      expect(result.status).toBe('FAILED');
    });

    it('should fail for frozen account', async () => {
      const result = await provider.confirm('provider-ref', '700000');
      expect(result.approved).toBe(false);
    });
  });

  describe('refund', () => {
    it('should always succeed', async () => {
      const result = await provider.refund('provider-ref', 1000);
      expect(result.success).toBe(true);
      expect(result.refundRef).toBeTruthy();
    });
  });

  describe('simulateAuth', () => {
    it('should succeed for AUTHORIZED', async () => {
      const result = await provider.simulateAuth('CBE', '100000', 2500, 'AUTHORIZED');
      expect(result.approved).toBe(true);
      expect(result.status).toBe('COMPLETED');
      expect(result.bankTransactionId).toBeTruthy();
    });

    it('should fail for DECLINED', async () => {
      const result = await provider.simulateAuth('CBE', '100000', 2500, 'DECLINED');
      expect(result.approved).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toBe('Payment declined by bank');
    });

    it('should fail for INSUFFICIENT_BALANCE', async () => {
      const result = await provider.simulateAuth('CBE', '100000', 2500, 'INSUFFICIENT_BALANCE');
      expect(result.approved).toBe(false);
      expect(result.failureReason).toBe('Insufficient balance');
    });

    it('should fail for TIMEOUT', async () => {
      const result = await provider.simulateAuth('CBE', '100000', 2500, 'TIMEOUT');
      expect(result.approved).toBe(false);
      expect(result.failureReason).toBe('Bank request timed out');
    });
  });
});
