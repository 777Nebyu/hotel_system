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
      const fromAddress = this.config.get<string>(
        'email.from',
        'noreply@luxstay.com',
      );
      const from = fromAddress.includes('<')
        ? fromAddress
        : `"LuxStay" <${fromAddress}>`;
      const res = await this.transporter.sendMail({
        from,
        ...input,
      });
      this.logger.log(
        `Email sent successfully to ${input.to} (subject: "${input.subject}", messageId: ${res.messageId})`,
      );
      return res;
    } catch (err) {
      this.logger.warn(
        `Failed to send "${input.subject}" to ${input.to}: ${err}`,
      );
    }
  }

  verificationMail(to: string, token: string): MailJob {
    const webUrl = this.config.get<string>(
      'webOrigin',
      'http://localhost:4000',
    );
    const verifyUrl = `${webUrl}/auth/verify-email?token=${token}`;
    return {
      to,
      subject: 'Verify Your Email Address — LuxStay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #D4AF37, #996515); border-radius: 12px; color: #ffffff; font-weight: bold; font-size: 20px; font-family: serif;">L</div>
            <h1 style="color: #0F2942; font-size: 24px; font-weight: bold; margin: 12px 0 4px 0;">LuxStay</h1>
            <p style="color: #64748B; font-size: 14px; margin: 0;">Account Email Verification</p>
          </div>
          <div style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 28px;">
            <p>Hello,</p>
            <p>Thank you for registering with <strong>LuxStay</strong>. Before you can sign in and begin booking luxury suites across Ethiopia, please verify your email address by clicking the button below:</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="background-color: #0F2942; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(15, 41, 66, 0.2);">
              Verify Email Address
            </a>
          </div>
          <p style="color: #64748B; font-size: 13px; line-height: 1.5;">
            If the button doesn't work, copy and paste this link into your browser:<br />
            <a href="${verifyUrl}" style="color: #2563EB; word-break: break-all;">${verifyUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
          <p style="color: #94A3B8; font-size: 12px; margin: 0; text-align: center;">
            If you did not create an account with LuxStay, you can safely ignore this message.
          </p>
        </div>
      `,
    };
  }

  welcomeMail(to: string, fullName: string): MailJob {
    const webUrl = this.config.get<string>(
      'webOrigin',
      'http://localhost:4000',
    );
    const exploreUrl = `${webUrl}/search`;
    const name = fullName?.trim()
      ? fullName.trim().split(' ')[0]
      : 'Valued Guest';

    return {
      to,
      subject: `Welcome to LuxStay — Enjoy Your Journey!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 36px 28px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; box-shadow: 0 4px 24px rgba(0,0,0,0.04);">
          <!-- Brand Header -->
          <div style="text-align: center; margin-bottom: 28px;">
            <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; background: linear-gradient(135deg, #D4AF37, #996515); border-radius: 14px; color: #ffffff; font-weight: bold; font-size: 22px; font-family: Georgia, serif; box-shadow: 0 4px 12px rgba(212,175,55,0.3);">L</div>
            <h1 style="color: #0F2942; font-size: 26px; font-weight: bold; margin: 14px 0 4px 0; font-family: Georgia, serif;">LuxStay</h1>
            <p style="color: #D4AF37; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin: 0;">Authentic Ethiopian Hospitality & Elegance</p>
          </div>

          <!-- Hero Greeting -->
          <div style="color: #334155; font-size: 15px; line-height: 1.7; margin-bottom: 28px;">
            <p style="font-size: 19px; color: #0F2942; font-weight: bold; margin-bottom: 12px;">
              Warmest Welcome, ${name}! ✨
            </p>
            <p>
              We are delighted to welcome you to <strong>LuxStay</strong>. Whether you are traveling for a refined weekend getaway, cultural discovery, or business, our handpicked collection of luxury suites and boutique resorts across Ethiopia is ready to make every moment unforgettable.
            </p>
            <p>
              Your account is fully set up and ready to unlock curated member rates and personalized stay experiences.
            </p>
          </div>

          <!-- What You Can Enjoy -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 22px; margin-bottom: 30px;">
            <p style="color: #0F2942; font-weight: bold; font-size: 14px; margin-top: 0; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
              Here is what you can enjoy with us:
            </p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; vertical-align: top; width: 28px; font-size: 16px;">🌟</td>
                <td style="padding: 8px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                  <strong style="color: #0F2942;">Curated Stays:</strong> Exceptional boutique hotels and 5-star accommodations from Addis Ababa to the Simien Mountains and Hawassa.
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; vertical-align: top; width: 28px; font-size: 16px;">💎</td>
                <td style="padding: 8px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                  <strong style="color: #0F2942;">Exclusive Member Perks:</strong> Best rate guarantee, verified guest reviews, and tailored amenity requests.
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; vertical-align: top; width: 28px; font-size: 16px;">🛎️</td>
                <td style="padding: 8px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                  <strong style="color: #0F2942;">Concierge Support:</strong> 24/7 dedicated guest assistance and seamless digital bookings.
                </td>
              </tr>
            </table>
          </div>

          <!-- Call to Action Button -->
          <div style="text-align: center; margin: 34px 0;">
            <a href="${exploreUrl}" style="background: linear-gradient(135deg, #0F2942, #163859); color: #ffffff; padding: 15px 36px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 16px rgba(15, 41, 66, 0.25);">
              Explore Luxury Hotels & Resorts →
            </a>
          </div>

          <!-- Footer Signoff -->
          <div style="color: #64748B; font-size: 14px; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 28px;">
            <p style="margin-bottom: 4px;">Wishing you extraordinary journeys and pleasant stays,</p>
            <p style="color: #0F2942; font-weight: bold; margin: 0;">The LuxStay Team</p>
          </div>
        </div>
      `,
    };
  }

  passwordResetMail(to: string, token: string): MailJob {
    const webUrl = this.config.get<string>(
      'webOrigin',
      'http://localhost:4000',
    );
    const resetUrl = `${webUrl}/auth/reset-password?token=${token}`;
    return {
      to,
      subject: 'Verify Email to Reset Password — LuxStay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #D4AF37, #996515); border-radius: 12px; color: #ffffff; font-weight: bold; font-size: 20px; font-family: serif;">L</div>
            <h1 style="color: #0F2942; font-size: 24px; font-weight: bold; margin: 12px 0 4px 0;">LuxStay</h1>
            <p style="color: #64748B; font-size: 14px; margin: 0;">Password Reset Verification</p>
          </div>
          <div style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 28px;">
            <p>Hello,</p>
            <p>We received a request to reset the password for your LuxStay account. To verify your identity and proceed with changing your password, please click the button below:</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="background-color: #0F2942; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(15, 41, 66, 0.2);">
              Verify Email & Reset Password
            </a>
          </div>
          <p style="color: #64748B; font-size: 13px; line-height: 1.5;">
            This link is secure and will expire in <strong>1 hour</strong>. If the button above does not work, copy and paste this link into your browser:<br />
            <a href="${resetUrl}" style="color: #2563EB; word-break: break-all;">${resetUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
          <p style="color: #94A3B8; font-size: 12px; margin: 0; text-align: center;">
            If you did not request a password reset, please ignore this email or contact support if you suspect unauthorized activity.
          </p>
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
            <p style="margin: 4px 0;"><strong>Total Price:</strong> ETB ${details.total.toFixed(2)}</p>
          </div>
          <p>We look forward to hosting you!</p>
        </div>
      `,
    };
  }

  newBookingMail(
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
      subject: `New booking requires review - ${details.bookingRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
          <h2 style="color: #0F2942;">New Booking Received</h2>
          <p>A new reservation has been submitted for <strong>${details.hotelName}</strong> and requires your review.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 4px 0;"><strong>Booking Reference:</strong> ${details.bookingRef}</p>
            <p style="margin: 4px 0;"><strong>Check-in:</strong> ${details.checkIn}</p>
            <p style="margin: 4px 0;"><strong>Check-out:</strong> ${details.checkOut}</p>
            <p style="margin: 4px 0;"><strong>Total:</strong> ETB ${details.total.toFixed(2)}</p>
          </div>
          <p>Open the manager bookings dashboard to confirm or reject this reservation.</p>
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
            <p style="margin: 4px 0;"><strong>Amount Paid:</strong> ETB ${details.amount.toFixed(2)}</p>
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
          ${details.refundAmount !== undefined && details.refundAmount > 0 ? `<p>A refund of <strong>ETB ${details.refundAmount.toFixed(2)}</strong> has been processed to your payment method.</p>` : ''}
          <p>If you have questions, please contact our support team.</p>
        </div>
      `,
    };
  }
}
