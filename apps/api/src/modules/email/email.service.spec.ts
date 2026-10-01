import type { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: <T>(key: string, fallback?: T): T =>
      (overrides[key] as T) ?? (fallback as T),
  } as unknown as ConfigService;
}

describe('EmailService link construction', () => {
  const CORS_LIST = 'http://localhost:3000,http://localhost:4000';

  it('builds the verification link from a single origin, not the CORS list', () => {
    const service = new EmailService(
      makeConfig({ webOrigin: CORS_LIST, webAppUrl: 'http://localhost:4000' }),
    );

    const mail = service.verificationMail('user@example.com', 'token-abc');

    expect(mail.html).toContain(
      'http://localhost:4000/auth/verify-email?token=token-abc',
    );
    expect(mail.html).not.toContain('localhost:3000');
    expect(mail.html).not.toContain('http://localhost:4000,');
  });

  it('strips a trailing slash from webAppUrl', () => {
    const service = new EmailService(
      makeConfig({ webAppUrl: 'https://luxstay.example.com/' }),
    );

    const mail = service.verificationMail('user@example.com', 't');

    expect(mail.html).toContain(
      'https://luxstay.example.com/auth/verify-email?token=t',
    );
  });

  it('falls back to localhost:4000 when no webAppUrl is configured', () => {
    const service = new EmailService(makeConfig({ webOrigin: CORS_LIST }));

    const reset = service.passwordResetMail('user@example.com', 'reset-1');
    const welcome = service.welcomeMail('user@example.com', 'Test User');

    expect(reset.html).toContain(
      'http://localhost:4000/auth/reset-password?token=reset-1',
    );
    expect(welcome.html).toContain('http://localhost:4000/search');
    expect(reset.html).not.toContain('localhost:3000');
    expect(welcome.html).not.toContain('localhost:3000');
  });

  it('escapes user-controlled values before placing them in HTML', () => {
    const service = new EmailService(
      makeConfig({ webAppUrl: 'http://localhost:4000' }),
    );

    const welcome = service.welcomeMail('a@b.com', '<img>');
    const booking = service.bookingConfirmationMail('a@b.com', {
      bookingRef: '<script>alert(1)</script>',
      hotelName: '<b>Unsafe Hotel</b>',
      checkIn: '2026-10-01',
      checkOut: '2026-10-02',
      total: 100,
    });

    expect(welcome.html).not.toContain('<img>');
    expect(welcome.html).toContain('&lt;img&gt;');
    expect(booking.html).not.toContain('<script>alert(1)</script>');
    expect(booking.html).toContain('&lt;b&gt;Unsafe Hotel&lt;/b&gt;');
  });

  it('sends verification, reset and welcome mail to the given recipient', () => {
    const service = new EmailService(
      makeConfig({ webAppUrl: 'http://localhost:4000' }),
    );

    expect(service.verificationMail('a@b.com', 'x').to).toBe('a@b.com');
    expect(service.passwordResetMail('a@b.com', 'y').to).toBe('a@b.com');
    expect(service.welcomeMail('a@b.com', 'Name').to).toBe('a@b.com');
  });
});
