import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  ChapaInitializeRequest,
  ChapaInitializeResponse,
  ChapaVerifyResponse,
} from './chapa.types';

@Injectable()
export class ChapaService {
  private readonly logger = new Logger(ChapaService.name);
  private readonly baseUrl: string;
  private readonly secretKey?: string;
  private readonly webhookSecret?: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('payment.chapaBaseUrl') ??
      'https://api.chapa.co/v1';
    this.secretKey = this.config.get<string>('payment.chapaSecretKey');
    this.webhookSecret = this.config.get<string>('payment.chapaWebhookSecret');
  }

  /**
   * Initialize a hosted checkout transaction with Chapa API.
   */
  async initialize(
    req: ChapaInitializeRequest,
  ): Promise<ChapaInitializeResponse> {
    if (!this.secretKey) {
      throw new BadRequestException('CHAPA_SECRET_KEY is not configured');
    }

    const endpoint = `${this.baseUrl}/transaction/initialize`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req),
      });

      const body = (await response.json()) as ChapaInitializeResponse;

      if (!response.ok || body.status !== 'success') {
        this.logger.error({
          message: 'Chapa transaction initialize failed',
          status: response.status,
          response: body,
          txRef: req.tx_ref,
        });
        throw new BadGatewayException(
          body.message || 'Failed to initialize Chapa transaction',
        );
      }

      return body;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      this.logger.error({
        message: 'Network error calling Chapa initialize',
        error: (error as Error).message,
        txRef: req.tx_ref,
      });
      throw new BadGatewayException('Chapa service unreachable');
    }
  }

  /**
   * Re-verify a transaction with Chapa API server-to-server.
   */
  async verify(txRef: string): Promise<ChapaVerifyResponse> {
    if (!this.secretKey) {
      throw new BadRequestException('CHAPA_SECRET_KEY is not configured');
    }

    const endpoint = `${this.baseUrl}/transaction/verify/${encodeURIComponent(txRef)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const body = (await response.json()) as ChapaVerifyResponse;

      if (!response.ok) {
        this.logger.error({
          message: 'Chapa transaction verify failed',
          status: response.status,
          response: body,
          txRef,
        });
        throw new BadGatewayException(
          body.message || 'Failed to verify transaction with Chapa',
        );
      }

      return body;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      this.logger.error({
        message: 'Network error calling Chapa verify',
        error: (error as Error).message,
        txRef,
      });
      throw new BadGatewayException('Chapa verification service unreachable');
    }
  }

  /**
   * Verify HMAC-SHA256 signature on incoming Chapa webhooks.
   */
  verifySignature(
    rawBody: string | Buffer,
    signature: string | undefined,
  ): boolean {
    if (!signature || !this.webhookSecret) {
      return false;
    }

    try {
      const expectedHash = createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedHash, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch {
      return false;
    }
  }
}
