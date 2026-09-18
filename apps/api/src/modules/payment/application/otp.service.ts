import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';

const SALT_ROUNDS = 10;
const OTP_LENGTH = 6;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly otpExpirySeconds: number;
  private readonly maxAttempts: number;
  private readonly resendCooldownSeconds: number;

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.otpExpirySeconds = this.config.get('MOCK_OTP_EXPIRY', 300);
    this.maxAttempts = this.config.get('MOCK_OTP_MAX_ATTEMPTS', 5);
    this.resendCooldownSeconds = this.config.get('MOCK_OTP_RESEND_COOLDOWN', 60);
  }

  /**
   * Generate a 6-digit OTP, hash it, and store on the Payment record.
   * Returns the plaintext code (to be sent via mock SMS only).
   */
  async generateOtp(
    paymentId: string,
  ): Promise<{ code: string; expiresAt: Date }> {
    const code = this.generateCode();
    const hash = await bcrypt.hash(code, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + this.otpExpirySeconds * 1000);

    await this.db.payment.update({
      where: { id: paymentId },
      data: {
        verificationCodeHash: hash,
        verificationExpiresAt: expiresAt,
        verificationAttempts: 0,
        status: 'OTP_SENT',
      },
    });

    await this.recordEvent(paymentId, 'OTP_SENT', 'OTP_SENT', {
      expiresAt: expiresAt.toISOString(),
    });

    this.logger.log({
      message: 'OTP generated',
      paymentId,
      expiresAt: expiresAt.toISOString(),
    });

    return { code, expiresAt };
  }

  /**
   * Verify an OTP code against the stored hash.
   */
  async verifyOtp(
    paymentId: string,
    code: string,
  ): Promise<{ valid: boolean; reason?: 'INVALID' | 'EXPIRED' | 'MAX_ATTEMPTS' }> {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return { valid: false, reason: 'INVALID' };
    }

    // Check if OTP exists
    if (!payment.verificationCodeHash) {
      return { valid: false, reason: 'INVALID' };
    }

    // Check expiry
    if (
      payment.verificationExpiresAt &&
      payment.verificationExpiresAt < new Date()
    ) {
      await this.recordEvent(paymentId, 'OTP_EXPIRED', 'EXPIRED');
      return { valid: false, reason: 'EXPIRED' };
    }

    // Check attempts
    if (payment.verificationAttempts >= this.maxAttempts) {
      await this.recordEvent(paymentId, 'OTP_MAX_ATTEMPTS', 'FAILED', {
        attempts: payment.verificationAttempts,
      });
      return { valid: false, reason: 'MAX_ATTEMPTS' };
    }

    // Increment attempts
    await this.db.payment.update({
      where: { id: paymentId },
      data: { verificationAttempts: { increment: 1 } },
    });

    // Verify
    const match = await bcrypt.compare(code, payment.verificationCodeHash);

    if (!match) {
      await this.recordEvent(paymentId, 'OTP_INVALID', 'FAILED', {
        attempt: payment.verificationAttempts + 1,
      });
      return { valid: false, reason: 'INVALID' };
    }

    await this.recordEvent(paymentId, 'OTP_VERIFIED', 'PROCESSING');
    return { valid: true };
  }

  /**
   * Resend OTP with cooldown check.
   */
  async resendOtp(
    paymentId: string,
  ): Promise<{ code: string; expiresAt: Date } | { error: 'COOLDOWN' | 'NOT_FOUND' }> {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return { error: 'NOT_FOUND' };
    }

    // Check cooldown (if last OTP was sent recently)
    if (payment.verificationExpiresAt) {
      const lastOtpAge =
        (Date.now() - payment.createdAt.getTime()) / 1000;
      // If the current OTP hasn't expired yet and was sent recently, enforce cooldown
      if (
        payment.verificationExpiresAt > new Date() &&
        payment.verificationAttempts > 0
      ) {
        // Allow resend only after cooldown from the last attempt
        const timeSinceLastAttempt =
          (Date.now() -
            (payment.updatedAt?.getTime() ?? payment.createdAt.getTime())) /
          1000;
        if (timeSinceLastAttempt < this.resendCooldownSeconds) {
          return { error: 'COOLDOWN' };
        }
      }
    }

    return this.generateOtp(paymentId);
  }

  /**
   * Check if the payment is in a state where OTP can be verified.
   */
  canVerifyOtp(status: string): boolean {
    return status === 'OTP_SENT';
  }

  private generateCode(): string {
    const min = Math.pow(10, OTP_LENGTH - 1);
    const max = Math.pow(10, OTP_LENGTH) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  private async recordEvent(
    paymentId: string,
    eventType: string,
    status: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.db.paymentEvent.create({
      data: {
        paymentId,
        eventType,
        status,
        payload: payload ? (payload as never) : undefined,
      },
    });
  }
}
