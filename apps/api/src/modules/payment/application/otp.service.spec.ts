import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../prisma/prisma.service';
import { OtpService } from './otp.service';

describe('OtpService', () => {
  let db: any;
  let config: any;
  let service: OtpService;

  const mockPayment = {
    id: 'payment-1',
    verificationCodeHash: null,
    verificationExpiresAt: null,
    verificationAttempts: 0,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    db = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({ ...mockPayment }),
        update: jest.fn().mockResolvedValue({}),
      },
      paymentEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    config = {
      get: jest.fn((key: string, defaultVal: unknown) => {
        const defaults: Record<string, unknown> = {
          MOCK_OTP_EXPIRY: 300,
          MOCK_OTP_MAX_ATTEMPTS: 5,
          MOCK_OTP_RESEND_COOLDOWN: 60,
        };
        return defaults[key] ?? defaultVal;
      }),
    };
    service = new OtpService(db as PrismaService, config as ConfigService);
  });

  describe('generateOtp', () => {
    it('should generate a 6-digit OTP code', async () => {
      const { code } = await service.generateOtp('payment-1');
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    });

    it('should hash the OTP and store on payment', async () => {
      const { code } = await service.generateOtp('payment-1');
      expect(db.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: expect.objectContaining({
          verificationCodeHash: expect.any(String),
          status: 'OTP_SENT',
        }),
      });
      // Hash should not be the plaintext code
      const storedHash = db.payment.update.mock.calls[0][0].data.verificationCodeHash;
      expect(storedHash).not.toBe(code);
    });

    it('should set expiry time', async () => {
      await service.generateOtp('payment-1');
      const updateCall = db.payment.update.mock.calls[0][0];
      expect(updateCall.data.verificationExpiresAt).toBeInstanceOf(Date);
      expect(updateCall.data.verificationExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should record OTP_SENT event', async () => {
      await service.generateOtp('payment-1');
      expect(db.paymentEvent.create).toHaveBeenCalledWith({
        data: {
          paymentId: 'payment-1',
          eventType: 'OTP_SENT',
          status: 'OTP_SENT',
          payload: expect.objectContaining({ expiresAt: expect.any(String) }),
        },
      });
    });

    it('should reset verification attempts to 0', async () => {
      await service.generateOtp('payment-1');
      const updateCall = db.payment.update.mock.calls[0][0];
      expect(updateCall.data.verificationAttempts).toBe(0);
    });
  });

  describe('verifyOtp', () => {
    it('should return INVALID for non-existent payment', async () => {
      db.payment.findUnique.mockResolvedValue(null);
      const result = await service.verifyOtp('nonexistent', '123456');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID');
    });

    it('should return INVALID when no hash stored', async () => {
      db.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        verificationCodeHash: null,
      });
      const result = await service.verifyOtp('payment-1', '123456');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID');
    });

    it('should return EXPIRED when OTP has expired', async () => {
      db.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        verificationCodeHash: '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
        verificationExpiresAt: new Date(Date.now() - 1000), // 1 second ago
        verificationAttempts: 0,
      });
      const result = await service.verifyOtp('payment-1', '123456');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('EXPIRED');
    });

    it('should return MAX_ATTEMPTS when too many attempts', async () => {
      db.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        verificationCodeHash: '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
        verificationExpiresAt: new Date(Date.now() + 300000),
        verificationAttempts: 5,
      });
      const result = await service.verifyOtp('payment-1', '123456');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('MAX_ATTEMPTS');
    });

    it('should increment attempts on wrong code', async () => {
      // First generate a real OTP so we have a valid hash
      const { code } = await service.generateOtp('payment-1');
      jest.clearAllMocks();

      // Mock finding the payment with the stored hash
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash(code, 10);
      db.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        verificationCodeHash: hash,
        verificationExpiresAt: new Date(Date.now() + 300000),
        verificationAttempts: 0,
      });

      const result = await service.verifyOtp('payment-1', '000000'); // Wrong code
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID');
      expect(db.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationAttempts: { increment: 1 },
          }),
        }),
      );
    });

    it('should return valid for correct code', async () => {
      const { code } = await service.generateOtp('payment-1');
      jest.clearAllMocks();

      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash(code, 10);
      db.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        verificationCodeHash: hash,
        verificationExpiresAt: new Date(Date.now() + 300000),
        verificationAttempts: 0,
      });

      const result = await service.verifyOtp('payment-1', code);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should record OTP_VERIFIED event on success', async () => {
      const { code } = await service.generateOtp('payment-1');
      jest.clearAllMocks();

      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash(code, 10);
      db.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        verificationCodeHash: hash,
        verificationExpiresAt: new Date(Date.now() + 300000),
        verificationAttempts: 0,
      });

      await service.verifyOtp('payment-1', code);
      expect(db.paymentEvent.create).toHaveBeenCalledWith({
        data: {
          paymentId: 'payment-1',
          eventType: 'OTP_VERIFIED',
          status: 'PROCESSING',
        },
      });
    });
  });

  describe('canVerifyOtp', () => {
    it('should return true for OTP_SENT status', () => {
      expect(service.canVerifyOtp('OTP_SENT')).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(service.canVerifyOtp('PENDING')).toBe(false);
      expect(service.canVerifyOtp('SUCCEEDED')).toBe(false);
      expect(service.canVerifyOtp('FAILED')).toBe(false);
    });
  });

  describe('resendOtp', () => {
    it('should return NOT_FOUND for non-existent payment', async () => {
      db.payment.findUnique.mockResolvedValue(null);
      const result = await service.resendOtp('nonexistent');
      expect(result).toEqual({ error: 'NOT_FOUND' });
    });

    it('should generate new OTP on resend', async () => {
      db.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        verificationExpiresAt: new Date(Date.now() - 1000), // Expired
        verificationAttempts: 0,
      });
      const result = await service.resendOtp('payment-1');
      expect('code' in result).toBe(true);
      if ('code' in result) {
        expect(result.code).toMatch(/^\d{6}$/);
      }
    });
  });
});
