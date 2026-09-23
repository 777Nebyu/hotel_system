import { ChapaMockProvider } from './chapa-mock.provider';

describe('ChapaMockProvider', () => {
  let provider: ChapaMockProvider;
  let mockOtpService: any;
  let mockSmsService: any;
  let mockBank: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOtpService = {
      generateOtp: jest.fn().mockResolvedValue({
        code: '482731',
        expiresAt: new Date(Date.now() + 300000),
      }),
      verifyOtp: jest.fn(),
    };
    mockSmsService = {
      send: jest.fn(),
    };
    mockBank = {
      simulateAuth: jest.fn().mockResolvedValue({
        approved: true,
        status: 'COMPLETED',
        bankTransactionId: 'BANK-MOCK-abc123',
      }),
    };
    mockDb = {
      payment: {
        update: jest.fn().mockResolvedValue({}),
      },
      paymentEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    provider = new ChapaMockProvider(
      mockBank,
      mockOtpService,
      mockSmsService,
      mockDb,
    );
  });

  describe('generateTxRef', () => {
    it('should generate a Chapa-style tx_ref', () => {
      const txRef = provider.generateTxRef();
      expect(txRef).toMatch(/^CHP-YT-\d{8}-[A-Z0-9]{6}$/);
    });

    it('should generate unique references', () => {
      const refs = new Set<string>();
      for (let i = 0; i < 100; i++) {
        refs.add(provider.generateTxRef());
      }
      expect(refs.size).toBe(100);
    });
  });

  describe('initializeTelebirr', () => {
    it('should generate OTP and send mock SMS', async () => {
      const result = await provider.initializeTelebirr(
        'payment-1',
        'CHP-YT-20260918-ABC123',
        2500,
        '+251911111111',
      );

      expect(result.status).toBe('OTP_SENT');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockOtpService.generateOtp).toHaveBeenCalledWith('payment-1');
      expect(mockSmsService.send).toHaveBeenCalledWith(
        '+251911111111',
        expect.stringContaining('482731'),
      );
    });

    it('should include amount and reference in SMS', async () => {
      await provider.initializeTelebirr(
        'payment-1',
        'CHP-YT-20260918-ABC123',
        2500,
        '+251911111111',
      );

      const smsBody = mockSmsService.send.mock.calls[0][1];
      expect(smsBody).toContain('ETB 2,500');
      expect(smsBody).toContain('CHP-YT-20260918-ABC123');
      expect(smsBody).toContain('YayeTech Payment');
    });
  });

  describe('initializeBank', () => {
    it('should update payment status to PROCESSING', async () => {
      const result = await provider.initializeBank(
        'payment-1',
        'CHP-YT-20260918-ABC123',
        2500,
        'CBE',
        '100000',
      );

      expect(result.status).toBe('PROCESSING');
      expect(result.bankTransactionId).toBeTruthy();
      expect(mockDb.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: expect.objectContaining({
          status: 'PROCESSING',
          bankCode: 'CBE',
          transactionId: expect.stringContaining('BANK-MOCK-'),
        }),
      });
    });

    it('should record BANK_INITIALIZED event', async () => {
      await provider.initializeBank(
        'payment-1',
        'CHP-YT-20260918-ABC123',
        2500,
        'CBE',
        '100000',
      );

      expect(mockDb.paymentEvent.create).toHaveBeenCalledWith({
        data: {
          paymentId: 'payment-1',
          eventType: 'BANK_INITIALIZED',
          status: 'PROCESSING',
          payload: expect.objectContaining({
            bankCode: 'CBE',
            bankTransactionId: expect.stringContaining('BANK-MOCK-'),
          }),
        },
      });
    });
  });

  describe('handleBankAuthorization', () => {
    it('should delegate to bank provider', async () => {
      const result = await provider.handleBankAuthorization(
        'payment-1',
        'CBE',
        '100000',
        2500,
        'AUTHORIZED',
      );

      expect(mockBank.simulateAuth).toHaveBeenCalledWith('CBE', '100000', 2500, 'AUTHORIZED');
      expect(result.approved).toBe(true);
    });

    it('should record BANK_AUTH_RESULT event', async () => {
      await provider.handleBankAuthorization(
        'payment-1',
        'CBE',
        '100000',
        2500,
        'AUTHORIZED',
      );

      expect(mockDb.paymentEvent.create).toHaveBeenCalledWith({
        data: {
          paymentId: 'payment-1',
          eventType: 'BANK_AUTH_RESULT',
          status: 'COMPLETED',
          payload: expect.objectContaining({
            bankCode: 'CBE',
            outcome: 'AUTHORIZED',
          }),
        },
      });
    });
  });

  describe('isSupportedMethod', () => {
    it('should return true for supported methods', () => {
      expect(provider.isSupportedMethod('TELEBIRR')).toBe(true);
      expect(provider.isSupportedMethod('CBE_BIRR')).toBe(true);
      expect(provider.isSupportedMethod('AWASH_BANK')).toBe(true);
      expect(provider.isSupportedMethod('ENAT_BANK')).toBe(true);
      expect(provider.isSupportedMethod('AMHARA_BANK')).toBe(true);
      expect(provider.isSupportedMethod('COOP_BANK')).toBe(true);
    });

    it('should return false for unsupported methods', () => {
      expect(provider.isSupportedMethod('CREDIT_CARD')).toBe(false);
      expect(provider.isSupportedMethod('PAYPAL')).toBe(false);
      expect(provider.isSupportedMethod('CASH')).toBe(false);
    });
  });

  describe('getBankCode', () => {
    it('should return correct bank codes', () => {
      expect(provider.getBankCode('CBE_BIRR')).toBe('CBE');
      expect(provider.getBankCode('AWASH_BANK')).toBe('AWASH');
      expect(provider.getBankCode('ENAT_BANK')).toBe('ENAT');
      expect(provider.getBankCode('AMHARA_BANK')).toBe('AMHARA');
      expect(provider.getBankCode('COOP_BANK')).toBe('COOP');
    });

    it('should return undefined for unknown methods', () => {
      expect(provider.getBankCode('TELEBIRR')).toBeUndefined();
      expect(provider.getBankCode('CREDIT_CARD')).toBeUndefined();
    });
  });
});
