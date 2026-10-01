import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { ChapaService } from './chapa.service';

describe('ChapaService', () => {
  let service: ChapaService;
  let mockConfig: Partial<ConfigService>;
  const secretKey = 'CHASECK_TEST-1234567890';
  const webhookSecret = 'test-webhook-secret-key-123';
  const baseUrl = 'https://api.chapa.co/v1';

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'payment.chapaSecretKey') return secretKey;
        if (key === 'payment.chapaWebhookSecret') return webhookSecret;
        if (key === 'payment.chapaBaseUrl') return baseUrl;
        return undefined;
      }) as any,
    };

    service = new ChapaService(mockConfig as ConfigService);
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initialize', () => {
    it('initializes a hosted checkout transaction successfully', async () => {
      const mockResponse = {
        message: 'Hosted Link',
        status: 'success',
        data: {
          checkout_url: 'https://checkout.chapa.co/checkout/payment/token123',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await service.initialize({
        amount: 500,
        currency: 'ETB',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        tx_ref: 'CHP-YT-20260926-TEST01',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.chapa.co/v1/transaction/initialize',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(res.data?.checkout_url).toBe(
        'https://checkout.chapa.co/checkout/payment/token123',
      );
    });

    it('throws BadGatewayException when Chapa API responds with failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid currency', status: 'failed' }),
      });

      await expect(
        service.initialize({
          amount: 500,
          currency: 'INVALID',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          tx_ref: 'CHP-YT-20260926-FAIL01',
        }),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('verify', () => {
    it('verifies a transaction with Chapa API server-to-server', async () => {
      const mockVerifyResponse = {
        message: 'Payment details',
        status: 'success',
        data: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'test@example.com',
          currency: 'ETB',
          amount: 500,
          status: 'success',
          reference: 'CHAPA-REF-12345',
          tx_ref: 'CHP-YT-20260926-TEST01',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVerifyResponse,
      });

      const res = await service.verify('CHP-YT-20260926-TEST01');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.chapa.co/v1/transaction/verify/CHP-YT-20260926-TEST01',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${secretKey}`,
          }),
        }),
      );
      expect(res.data?.status).toBe('success');
      expect(res.data?.amount).toBe(500);
    });
  });

  describe('verifySignature', () => {
    it('validates a correct HMAC signature', () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        tx_ref: 'CHP-YT-20260926-TEST01',
        status: 'success',
      });
      const validSig = createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      expect(service.verifySignature(payload, validSig)).toBe(true);
    });

    it('rejects an invalid or tampered HMAC signature', () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        tx_ref: 'CHP-YT-20260926-TEST01',
        status: 'success',
      });
      const invalidSig = 'invalid-tampered-signature-000000000000000000000000';

      expect(service.verifySignature(payload, invalidSig)).toBe(false);
    });

    it('returns false when signature is undefined', () => {
      expect(service.verifySignature('body', undefined)).toBe(false);
    });
  });
});
