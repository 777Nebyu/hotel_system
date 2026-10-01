import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { MailProducer } from '../../jobs/mail.producer';
import type { StorageService } from '../../../common/storage/storage';
import { IdentityService } from './identity.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

const MOCK_SECRET = 'super-secret-key-that-is-at-least-32-chars-long';

// jest.Mock is untyped, so pull the first call argument out explicitly
// instead of letting `any` leak into the assertions.
const callArg = <T>(mock: jest.Mock, index = 0): T => {
  const calls = mock.mock.calls as unknown[][];
  return calls[index]?.[0] as T;
};

type UserDelegateMock = {
  findUnique: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

type HotelDelegateMock = {
  findFirst: jest.Mock;
};

type UserSessionDelegateMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
};

describe('IdentityService', () => {
  let service: IdentityService;
  let db: {
    user: UserDelegateMock;
    hotel: HotelDelegateMock;
    userSession: UserSessionDelegateMock;
  };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let config: { getOrThrow: jest.Mock; get: jest.Mock };
  let mail: {
    enqueueVerification: jest.Mock;
    enqueueWelcome: jest.Mock;
    enqueuePasswordReset: jest.Mock;
  };
  let storage: { upload: jest.Mock; remove: jest.Mock };

  const baseUser = {
    id: 'user-1',
    email: 'test@example.com',
    fullName: 'Test User',
    phone: null,
    role: 'CUSTOMER' as const,
    status: 'ACTIVE' as const,
    isActive: true,
    profilePhotoUrl: null,
    emailVerified: true,
    emailVerifiedAt: new Date(),
    verificationToken: null,
    verificationTokenExpiresAt: null,
    resetPasswordToken: null,
    resetPasswordExpiresAt: null,
    refreshTokenHash: 'old-hash',
    refreshTokenFamily: 'family-abc',
    lastLoginAt: null,
    loginAttempts: 0,
    lockedUntil: null,
    passwordHash: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    db = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      hotel: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      userSession: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve({ id: 'session-1', ...args.data }),
          ),
        update: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve({ id: args.where.id, ...args.data }),
          ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('mock-access-token'),
      verifyAsync: jest.fn(),
    };
    config = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'jwt.accessSecret' || key === 'jwt.refreshSecret')
          return MOCK_SECRET;
        return '15m';
      }),
      get: jest.fn((key: string) =>
        key === 'googleClientId'
          ? 'test-google-client-id.apps.googleusercontent.com'
          : undefined,
      ),
    };
    mail = {
      enqueueVerification: jest.fn().mockResolvedValue(undefined),
      enqueueWelcome: jest.fn().mockResolvedValue(undefined),
      enqueuePasswordReset: jest.fn().mockResolvedValue(undefined),
    };
    storage = {
      upload: jest
        .fn()
        .mockResolvedValue({ url: '/uploads/profiles/x.jpg', publicId: null }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    service = new IdentityService(
      db as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      mail as unknown as MailProducer,
      storage,
    );
  });

  // ─── Registration ──────────────────────────────────────────────────────────

  it('rejects duplicate registrations', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.register({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('registers a new user and returns a safe user with tokens', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({
      ...baseUser,
      verificationToken: 'v-token',
    });
    db.user.update.mockResolvedValue({});

    const result = await service.register({
      email: 'Test@Example.com',
      password: 'password123',
      fullName: 'Test User',
    });

    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ email: 'test@example.com' }),
      }),
    );
    expect(result.user.email).toBe('test@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user).not.toHaveProperty('refreshTokenHash');
    expect(result.user).not.toHaveProperty('refreshTokenFamily');
    expect(result.user).not.toHaveProperty('loginAttempts');
    expect(result.user).not.toHaveProperty('lockedUntil');
    expect(result.accessToken).toBe('');
    expect(mail.enqueueVerification).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(String),
    );
  });

  // ─── Login ─────────────────────────────────────────────────────────────────

  it('rejects login with invalid credentials', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'test@example.com', password: 'wrongpassword' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('increments loginAttempts on a failed login', async () => {
    db.user.findUnique.mockResolvedValue({ ...baseUser, loginAttempts: 2 });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'test@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ loginAttempts: 3 }),
      }),
    );
  });

  it('locks the account after MAX_LOGIN_ATTEMPTS failures', async () => {
    db.user.findUnique.mockResolvedValue({ ...baseUser, loginAttempts: 9 });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'test@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loginAttempts: 10,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          lockedUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects login while account is locked (even with correct password)', async () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000);
    db.user.findUnique.mockResolvedValue({
      ...baseUser,
      lockedUntil: futureDate,
    });

    await expect(
      service.login({ email: 'test@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    // Password comparison must not happen for a locked account
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('rejects login for a deactivated (isActive=false) account with 403', async () => {
    db.user.findUnique.mockResolvedValue({ ...baseUser, isActive: false });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login({ email: 'test@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects login for an unverified (EMAIL_UNVERIFIED) user with 403', async () => {
    db.user.findUnique.mockResolvedValue({
      ...baseUser,
      status: 'EMAIL_UNVERIFIED',
      emailVerifiedAt: null,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login({ email: 'test@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('logs in with valid credentials, resets counters, and updates lastLoginAt', async () => {
    db.user.findUnique.mockResolvedValue({
      ...baseUser,
      loginAttempts: 3,
    });
    db.user.update.mockResolvedValue({});
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result.accessToken).toBe('mock-access-token');
    // Verify the counter-reset + lastLoginAt update
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loginAttempts: 0,
          lockedUntil: null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          lastLoginAt: expect.any(Date),
        }),
      }),
    );
    // Verify the refresh-token hash + family are persisted
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          refreshTokenHash: expect.any(String),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          refreshTokenFamily: expect.any(String),
        }),
      }),
    );
  });

  it('includes hotelId in the JWT payload for a MANAGER user', async () => {
    const managerUser = { ...baseUser, role: 'MANAGER' as const };
    db.user.findUnique.mockResolvedValue(managerUser);
    db.hotel.findFirst.mockResolvedValue({ id: 'hotel-99' });
    db.user.update.mockResolvedValue({});
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await service.login({ email: 'manager@example.com', password: 'pass' });

    // jwt.signAsync should have been called with a payload containing hotelId
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ hotelId: 'hotel-99', role: 'MANAGER' }),
      expect.any(Object),
    );
  });

  it('does NOT include hotelId in the JWT payload for a CUSTOMER user', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    db.user.update.mockResolvedValue({});
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await service.login({ email: 'test@example.com', password: 'pass' });

    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.not.objectContaining({ hotelId: expect.anything() }),
      expect.any(Object),
    );
  });

  // ─── Token refresh & compromise detection ─────────────────────────────────

  it('rejects an invalid (expired) refresh token', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(service.refresh('stale-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates the refresh token and forwards the same family ID', async () => {
    const incomingPayload = {
      sub: 'user-1',
      email: 'test@example.com',
      role: 'CUSTOMER',
      family: 'family-abc',
    };
    jwt.verifyAsync.mockResolvedValue(incomingPayload);
    db.user.findUnique.mockResolvedValue({
      ...baseUser,
      refreshTokenHash: 'old-hash',
      refreshTokenFamily: 'family-abc',
    });
    db.user.update.mockResolvedValue({});
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await service.refresh('valid-refresh-token');

    // Family ID must be forwarded (same family, new token)
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ family: 'family-abc' }),
      expect.any(Object),
    );
  });

  it('revokes the token family when a used refresh token is replayed (compromise detection)', async () => {
    // The incoming token verifies correctly, but the stored hash does NOT match
    // (i.e., the token was already rotated — this is a replay of a stolen token).
    const incomingPayload = {
      sub: 'user-1',
      email: 'test@example.com',
      role: 'CUSTOMER',
      family: 'family-abc',
    };
    jwt.verifyAsync.mockResolvedValue(incomingPayload);
    db.user.findUnique.mockResolvedValue({
      ...baseUser,
      refreshTokenHash: 'current-hash', // different from the replayed token
      refreshTokenFamily: 'family-abc',
    });
    db.user.update.mockResolvedValue({});
    // bcrypt.compare returns false — the hash does not match the replayed token
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.refresh('replayed-old-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    // Entire family must be revoked
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refreshTokenHash: null,
          refreshTokenFamily: null,
        }),
      }),
    );
  });

  it('rejects refresh for a deactivated account', async () => {
    const payload = {
      sub: 'user-1',
      email: 'test@example.com',
      role: 'CUSTOMER',
      family: 'family-abc',
    };
    jwt.verifyAsync.mockResolvedValue(payload);
    db.user.findUnique.mockResolvedValue({
      ...baseUser,
      isActive: false,
      refreshTokenFamily: 'family-abc',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(service.refresh('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // ─── Logout ────────────────────────────────────────────────────────────────

  it('invalidates both the token hash and the family on logout', async () => {
    db.user.update.mockResolvedValue({});

    await expect(service.logout('user-1')).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { refreshTokenHash: null, refreshTokenFamily: null },
    });
  });

  // ─── Password reset ────────────────────────────────────────────────────────

  it('resets the password and clears lockout state', async () => {
    db.user.findFirst.mockResolvedValue(baseUser);
    db.user.update.mockResolvedValue({});

    const result = await service.resetPassword('reset-token', 'newpassword123');

    expect(result.message).toBe('Password reset');
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resetPasswordToken: null,
          refreshTokenHash: null,
          refreshTokenFamily: null,
          loginAttempts: 0,
          lockedUntil: null,
        }),
      }),
    );
  });

  // ─── Profile ───────────────────────────────────────────────────────────────

  it('updates profile fields and password when current password matches', async () => {
    db.user.findUniqueOrThrow.mockResolvedValue(baseUser);
    db.user.update.mockResolvedValue({
      ...baseUser,
      fullName: 'New Name',
      phone: '123456',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.updateProfile('user-1', {
      fullName: 'New Name',
      phone: '123456',
      currentPassword: 'password123',
      newPassword: 'newpassword123',
    });

    expect(result.fullName).toBe('New Name');
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          passwordHash: expect.stringMatching(/^\$argon2id\$/),
        }),
      }),
    );
  });

  it('rejects a password change with the wrong current password', async () => {
    db.user.findUniqueOrThrow.mockResolvedValue(baseUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.updateProfile('user-1', {
        currentPassword: 'wrong',
        newPassword: 'newpassword123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('uploads a profile photo and stores the new url', async () => {
    const file = {
      buffer: Buffer.from('image-bytes'),
      originalname: 'me.jpg',
      mimetype: 'image/jpeg',
    };
    db.user.findUniqueOrThrow.mockResolvedValue({
      ...baseUser,
      profilePhotoUrl: null,
    });
    db.user.update.mockResolvedValue({
      ...baseUser,
      profilePhotoUrl: '/uploads/profiles/x.jpg',
    });

    const result = await service.updateProfilePhoto('user-1', file);

    expect(result.profilePhotoUrl).toBe('/uploads/profiles/x.jpg');
    expect(storage.upload).toHaveBeenCalledWith(file, 'profiles');
  });

  describe('Session Management', () => {
    it('creates a user session record upon login with device info', async () => {
      db.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(
        { email: 'test@example.com', password: 'password123' },
        {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          ipAddress: '127.0.0.1',
        },
      );

      expect(result.accessToken).toBeDefined();
      expect(db.userSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            ipAddress: '127.0.0.1',
            deviceName: expect.stringContaining('Windows'),
          }),
        }),
      );
    });

    it('lists active sessions and flags current session', async () => {
      const now = new Date();
      db.userSession.findMany.mockResolvedValue([
        {
          id: 'session-1',
          deviceName: 'Chrome on Windows',
          ipAddress: '127.0.0.1',
          lastActiveAt: now,
          createdAt: now,
        },
        {
          id: 'session-2',
          deviceName: 'Safari on iOS',
          ipAddress: '10.0.0.2',
          lastActiveAt: now,
          createdAt: now,
        },
      ]);

      const sessions = await service.listSessions('user-1', 'session-1');

      expect(sessions).toHaveLength(2);
      expect(sessions[0].isCurrent).toBe(true);
      expect(sessions[1].isCurrent).toBe(false);
    });

    it('revokes a specific session', async () => {
      db.userSession.findFirst.mockResolvedValue({
        id: 'session-2',
        userId: 'user-1',
      });

      const res = await service.revokeSession('user-1', 'session-2');

      expect(res.message).toContain('revoked');
      expect(db.userSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-2' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('revokes all other sessions except current', async () => {
      const res = await service.revokeAllOtherSessions('user-1', 'session-1');

      expect(res.message).toContain('revoked');
      expect(db.userSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            revokedAt: null,
            id: { not: 'session-1' },
          }),
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('rejects refresh token if session has been revoked', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'test@example.com',
        role: 'CUSTOMER',
        family: 'family-abc',
        sessionId: 'session-revoked',
      });
      db.user.findUnique.mockResolvedValue(baseUser);
      db.userSession.findUnique.mockResolvedValue({
        id: 'session-revoked',
        userId: 'user-1',
        revokedAt: new Date(),
        refreshTokenHash: 'hashed',
        family: 'family-abc',
      });

      await expect(service.refresh('token-revoked')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── Email verification ───────────────────────────────────────────────────
  describe('Email verification', () => {
    const HOUR = 60 * 60 * 1000;

    type RegisterCall = {
      data: {
        emailVerified: boolean;
        status: string;
        verificationToken: string;
        verificationTokenExpiresAt: Date;
      };
    };
    type UpdateCall = {
      where: { id: string };
      data: {
        emailVerified: boolean;
        emailVerifiedAt: Date | null;
        verificationToken: string | null;
        verificationTokenExpiresAt: Date | null;
        status: string;
      };
    };
    type ResendCall = {
      data: { verificationToken: string; verificationTokenExpiresAt: Date };
    };

    const unverifiedUser = {
      ...baseUser,
      emailVerified: false,
      emailVerifiedAt: null as Date | null,
      status: 'EMAIL_UNVERIFIED' as const,
      verificationToken: 'valid-token',
      verificationTokenExpiresAt: new Date(Date.now() + HOUR),
    };

    it('registers with emailVerified=false and a 24-hour expiring token', async () => {
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...baseUser, ...args.data }),
      );
      db.user.update.mockResolvedValue({});

      const before = Date.now();
      await service.register({
        email: 'new@example.com',
        password: 'password123',
        fullName: 'New User',
      });
      const after = Date.now();

      const { data } = callArg<RegisterCall>(db.user.create);
      expect(data.emailVerified).toBe(false);
      expect(data.status).toBe('EMAIL_UNVERIFIED');
      expect(data.verificationToken).toHaveLength(64);
      // The expiry must be exactly 24h after the timestamp used inside
      // register(), which is bracketed by `before`/`after`.
      const expiry = data.verificationTokenExpiresAt.getTime();
      expect(expiry).toBeGreaterThanOrEqual(before + 24 * HOUR);
      expect(expiry).toBeLessThanOrEqual(after + 24 * HOUR);
      expect(mail.enqueueVerification).toHaveBeenCalledWith(
        'new@example.com',
        data.verificationToken,
      );
    });

    it('marks the email verified, clears the token, and activates the account', async () => {
      db.user.findFirst.mockResolvedValue(unverifiedUser);
      db.user.update.mockResolvedValue({});

      const result = await service.verifyEmail('valid-token');

      expect(result).toEqual({
        message: 'Email verified successfully',
        verified: true,
      });
      expect(db.user.update).toHaveBeenCalledTimes(1);
      const { where, data } = callArg<UpdateCall>(db.user.update);
      expect(where).toEqual({ id: 'user-1' });
      expect(data.emailVerified).toBe(true);
      expect(data.emailVerifiedAt).toBeInstanceOf(Date);
      expect(data.verificationToken).toBeNull();
      expect(data.verificationTokenExpiresAt).toBeNull();
      expect(data.status).toBe('ACTIVE');
      expect(mail.enqueueWelcome).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
      );
    });

    it('rejects an expired verification token without mutating the user', async () => {
      db.user.findFirst.mockResolvedValue({
        ...unverifiedUser,
        verificationTokenExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verifyEmail('valid-token')).rejects.toThrow(
        'Verification link has expired',
      );
      expect(db.user.update).not.toHaveBeenCalled();
      expect(mail.enqueueWelcome).not.toHaveBeenCalled();
    });

    it('rejects an unknown verification token', async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('unknown-token')).rejects.toThrow(
        'Invalid or expired verification link',
      );
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('rejects an empty verification token', async () => {
      await expect(service.verifyEmail('')).rejects.toThrow(
        'Verification token is required',
      );
      expect(db.user.findFirst).not.toHaveBeenCalled();
    });

    it('prevents enumeration: known and unknown emails return the same message', async () => {
      db.user.findUnique.mockResolvedValue(null);
      const unknown =
        await service.resendVerificationEmail('ghost@example.com');

      db.user.findUnique.mockResolvedValue(unverifiedUser);
      db.user.update.mockResolvedValue({});
      const known = await service.resendVerificationEmail('test@example.com');

      expect(known.message).toBe(unknown.message);
      expect(mail.enqueueVerification).toHaveBeenCalledTimes(1);
    });

    it('issues a fresh 24-hour token on resend', async () => {
      db.user.findUnique.mockResolvedValue(unverifiedUser);
      db.user.update.mockResolvedValue({});

      const before = Date.now();
      await service.resendVerificationEmail('Test@Example.com');
      const after = Date.now();

      const { data } = callArg<ResendCall>(db.user.update);
      expect(data.verificationToken).toHaveLength(64);
      const expiry = data.verificationTokenExpiresAt.getTime();
      expect(expiry).toBeGreaterThanOrEqual(before + 24 * HOUR);
      expect(expiry).toBeLessThanOrEqual(after + 24 * HOUR);
      expect(mail.enqueueVerification).toHaveBeenCalledWith(
        'test@example.com',
        data.verificationToken,
      );
    });

    it('does not resend for an already verified account', async () => {
      db.user.findUnique.mockResolvedValue({
        ...baseUser,
        emailVerified: true,
        status: 'ACTIVE',
      });

      const res = await service.resendVerificationEmail('test@example.com');

      expect(res.message).toBe(
        'This email is already verified. You can sign in.',
      );
      expect(db.user.update).not.toHaveBeenCalled();
      expect(mail.enqueueVerification).not.toHaveBeenCalled();
    });

    it('blocks login when emailVerified is false', async () => {
      db.user.findUnique.mockResolvedValue({
        ...baseUser,
        emailVerified: true,
        emailVerifiedAt: null,
        status: 'ACTIVE',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── Guard: no path may mark an email verified except verifyEmail ─────────
  describe('No path verifies without the verification link', () => {
    it('resetPassword never writes the verification flags', async () => {
      db.user.findFirst.mockResolvedValue({
        ...baseUser,
        resetPasswordToken: 'reset-token',
      });
      db.user.update.mockResolvedValue({});

      await service.resetPassword('reset-token', 'newpassword123');

      const { data } = callArg<{ data: Record<string, unknown> }>(
        db.user.update,
      );
      expect(data).toHaveProperty('passwordHash');
      expect(data).not.toHaveProperty('emailVerified');
      expect(data).not.toHaveProperty('emailVerifiedAt');
    });

    it('requestPasswordReset never writes the verification flags', async () => {
      db.user.findUnique.mockResolvedValue(baseUser);
      db.user.update.mockResolvedValue({});

      const res = await service.requestPasswordReset('test@example.com');

      expect(res.message).toBe(
        'If the account exists, a reset email will be sent',
      );
      const { data } = callArg<{ data: Record<string, unknown> }>(
        db.user.update,
      );
      expect(data).toHaveProperty('resetPasswordToken');
      expect(data).not.toHaveProperty('emailVerified');
      expect(data).not.toHaveProperty('emailVerifiedAt');
    });

    it('googleAuth rejects a client-supplied email when no credential is present', async () => {
      await expect(
        service.googleAuth({
          email: 'victim@example.com',
          fullName: 'Anyone',
        }),
      ).rejects.toThrow('A verified Google credential is required');

      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(db.user.create).not.toHaveBeenCalled();
      expect(db.user.update).not.toHaveBeenCalled();
    });

    type GoogleProviderHarness = {
      googleClient: { verifyIdToken: jest.Mock };
      logger: { warn: jest.Mock };
    };

    const stubGoogle = (payload: Record<string, unknown>): jest.Mock => {
      const verifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => payload,
      });
      const target = service as unknown as GoogleProviderHarness;
      target.googleClient = { verifyIdToken };
      target.logger.warn = jest.fn();
      return verifyIdToken;
    };

    const validPayload = (overrides: Record<string, unknown> = {}) => ({
      email: 'google.user@example.com',
      email_verified: true,
      name: 'Google User',
      sub: 'sub-1001',
      ...overrides,
    });

    it('googleAuth pins the ID token audience to the client id', async () => {
      const verifyIdToken = stubGoogle(validPayload());
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({
        ...baseUser,
        email: 'google.user@example.com',
        fullName: 'Google User',
      });

      await service.googleAuth({ credential: 'header.payload.signature' });

      expect(config.get).toHaveBeenCalledWith('googleClientId');
      expect(verifyIdToken).toHaveBeenCalledWith({
        idToken: 'header.payload.signature',
        audience: 'test-google-client-id.apps.googleusercontent.com',
      });
      expect(db.user.create).toHaveBeenCalled();
    });

    it('googleAuth rejects a token pinned to the wrong audience', async () => {
      const audienceError = new Error(
        'Wrong recipient, payload audience != requiredAudience',
      );
      stubGoogle({}).mockRejectedValue(audienceError);

      await expect(
        service.googleAuth({ credential: 'header.payload.signature' }),
      ).rejects.toThrow('Invalid Google credential');

      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it('googleAuth rejects an unverified email claim', async () => {
      stubGoogle(
        validPayload({
          email: 'unverified@example.com',
          email_verified: false,
        }),
      );

      await expect(
        service.googleAuth({ credential: 'header.payload.signature' }),
      ).rejects.toThrow('Google did not provide a verified email address');

      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it('googleAuth rejects a token without a subject claim', async () => {
      stubGoogle({ email: 'google.user@example.com', email_verified: true });

      await expect(
        service.googleAuth({ credential: 'header.payload.signature' }),
      ).rejects.toThrow('Invalid Google credential');

      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it('googleAuth creates the account bound to the subject', async () => {
      stubGoogle(validPayload());
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({
        ...baseUser,
        email: 'google.user@example.com',
        googleId: 'sub-1001',
      });

      await service.googleAuth({ credential: 'header.payload.signature' });

      const created = callArg<{ data: { googleId: string } }>(db.user.create);
      expect(created.data.googleId).toBe('sub-1001');
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: 'sub-1001' },
      });
    });

    it('googleAuth matches on subject before the email claim', async () => {
      const existing = {
        ...baseUser,
        email: 'previous@example.com',
        googleId: 'sub-1001',
      };
      stubGoogle(validPayload());
      db.user.findUnique.mockResolvedValueOnce(existing);
      db.user.update.mockResolvedValue(existing);

      await service.googleAuth({ credential: 'header.payload.signature' });

      expect(db.user.findUnique).toHaveBeenCalledTimes(1);
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: 'sub-1001' },
      });
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it('googleAuth links a pre-existing account to the subject', async () => {
      const existing = { ...baseUser, googleId: null };
      stubGoogle(validPayload());
      db.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      db.user.update.mockResolvedValue({
        ...existing,
        googleId: 'sub-1001',
      });

      await service.googleAuth({ credential: 'header.payload.signature' });

      expect(db.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: { googleId: 'sub-1001' },
      });
      expect(db.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { email: 'google.user@example.com' },
      });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { googleId: 'sub-1001' },
      });
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it('googleAuth refuses an address bound to another subject', async () => {
      const bound = { ...baseUser, googleId: 'sub-9999' };
      stubGoogle(validPayload());
      db.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(bound);

      await expect(
        service.googleAuth({ credential: 'header.payload.signature' }),
      ).rejects.toThrow('linked to a different Google account');

      expect(db.user.create).not.toHaveBeenCalled();
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('googleAuth ignores client-supplied email and google id', async () => {
      stubGoogle(
        validPayload({ email: 'real@example.com', name: 'Real User' }),
      );
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({
        ...baseUser,
        email: 'real@example.com',
        googleId: 'sub-1001',
      });

      await service.googleAuth({
        credential: 'header.payload.signature',
        email: 'attacker@example.com',
        googleId: 'spoofed-google-sub',
      });

      const created = callArg<{ data: { email: string; googleId: string } }>(
        db.user.create,
      );
      expect(created.data.email).toBe('real@example.com');
      expect(created.data.googleId).toBe('sub-1001');
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'real@example.com' },
      });
    });
  });
});
