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

describe('IdentityService', () => {
  let service: IdentityService;
  let db: { user: UserDelegateMock; hotel: HotelDelegateMock };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let mail: {
    enqueueVerification: jest.Mock;
    enqueuePasswordReset: jest.Mock;
  };
  let storage: { upload: jest.Mock; remove: jest.Mock };

  const baseUser = {
    id: 'user-1',
    email: 'test@example.com',
    fullName: 'Test User',
    phone: null,
    role: 'CUSTOMER' as const,
    isActive: true,
    profilePhotoUrl: null,
    emailVerifiedAt: null,
    verificationToken: null,
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
    // Reset call counts on the module-level bcrypt mock so assertions like
    // "expect(bcrypt.compare).not.toHaveBeenCalled()" are scoped to the
    // current test only. clearAllMocks() preserves mock implementations
    // (mockResolvedValue set in jest.mock factory) while wiping call history.
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
    };
    mail = {
      enqueueVerification: jest.fn().mockResolvedValue(undefined),
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
      storage as unknown as StorageService,
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
    expect(result.accessToken).toBe('mock-access-token');
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
        data: expect.objectContaining({ passwordHash: 'hashed' }),
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

    const result = await service.updateProfilePhoto('user-1', file as never);

    expect(result.profilePhotoUrl).toBe('/uploads/profiles/x.jpg');
    expect(storage.upload).toHaveBeenCalledWith(file, 'profiles');
  });
});
