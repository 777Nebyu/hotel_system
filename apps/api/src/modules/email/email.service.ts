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
}
