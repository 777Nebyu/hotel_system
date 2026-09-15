import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailJob {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('email.host', 'localhost');
    const port = this.config.get<number>('email.port', 1025);
    const user = this.config.get<string>('email.user', '');
    const pass = this.config.get<string>('email.pass', '');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }

  async send(input: MailJob) {
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('email.from', 'noreply@yayetech.com'),
        ...input,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to send "${input.subject}" to ${input.to}: ${err}`,
      );
    }
  }

  verificationMail(to: string, token: string): MailJob {
    const webUrl = this.config.get<string>(
      'webOrigin',
      'http://localhost:3000',
    );
    const verifyUrl = `${webUrl}/verify-email?token=${token}`;
    return {
      to,
      subject: 'Verify Your YayeTech Hotel Account',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Welcome to YayeTech Hotel</h2>
          <p>Please click the link below to verify your email address:</p>
          <p><a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px;">Verify Email</a></p>
          <p>Or copy this link: ${verifyUrl}</p>
        </div>
      `,
    };
  }

  passwordResetMail(to: string, token: string): MailJob {
    const webUrl = this.config.get<string>(
      'webOrigin',
      'http://localhost:3000',
    );
    const resetUrl = `${webUrl}/reset-password?token=${token}`;
    return {
      to,
      subject: 'Reset Your Password - YayeTech Hotel',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Click the link below to reset your password (valid for 1 hour):</p>
          <p><a href="${resetUrl}" style="background-color: #dc2626; color: white; padding: 10px 18px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
          <p>Or copy this link: ${resetUrl}</p>
        </div>
      `,
    };
  }

  bookingConfirmationMail(
    to: string,
    details: {
      bookingRef: string;
      hotelName: string;
      checkIn: string;
      checkOut: string;
      total: number;
    },
  ): MailJob {
    return {
      to,
      subject: `Booking Confirmed - ${details.bookingRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.5;">
          <h2>Booking Confirmation</h2>
          <p>Thank you for booking with <strong>${details.hotelName}</strong>.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 4px 0;"><strong>Booking Reference:</strong> ${details.bookingRef}</p>
            <p style="margin: 4px 0;"><strong>Check-in:</strong> ${details.checkIn}</p>
            <p style="margin: 4px 0;"><strong>Check-out:</strong> ${details.checkOut}</p>
            <p style="margin: 4px 0;"><strong>Total Price:</strong> $${details.total.toFixed(2)}</p>
          </div>
          <p>We look forward to hosting you!</p>
        </div>
      `,
    };
  }

  paymentReceiptMail(
    to: string,
    details: {
      bookingRef: string;
      amount: number;
      method: string;
      providerRef?: string | null;
    },
  ): MailJob {
    return {
      to,
      subject: `Payment Receipt - ${details.bookingRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.5;">
          <h2>Payment Received</h2>
          <p>We have received your payment for booking <strong>${details.bookingRef}</strong>.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 4px 0;"><strong>Amount Paid:</strong> $${details.amount.toFixed(2)}</p>
            <p style="margin: 4px 0;"><strong>Payment Method:</strong> ${details.method}</p>
            ${details.providerRef ? `<p style="margin: 4px 0;"><strong>Transaction Ref:</strong> ${details.providerRef}</p>` : ''}
          </div>
          <p>Thank you for your business!</p>
        </div>
      `,
    };
  }

  bookingCancellationMail(
    to: string,
    details: {
      bookingRef: string;
      refundAmount?: number;
    },
  ): MailJob {
    return {
      to,
      subject: `Booking Cancelled - ${details.bookingRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.5;">
          <h2>Booking Cancellation Notice</h2>
          <p>Your booking <strong>${details.bookingRef}</strong> has been cancelled.</p>
          ${details.refundAmount !== undefined && details.refundAmount > 0 ? `<p>A refund of <strong>$${details.refundAmount.toFixed(2)}</strong> has been processed to your payment method.</p>` : ''}
          <p>If you have questions, please contact our support team.</p>
        </div>
      `,
    };
  }
}
