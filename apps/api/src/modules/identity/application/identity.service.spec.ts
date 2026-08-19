import { ConflictException, UnauthorizedException } from '@nestjs/common';
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

describe('IdentityService', () => {
  let service: IdentityService;
  let db: { user: UserDelegateMock };
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
    role: 'CUSTOMER',
    emailVerifiedAt: null,
    verificationToken: null,
    resetPasswordToken: null,
    resetPasswordExpiresAt: null,
    refreshTokenHash: null,
    passwordHash: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    db = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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
    expect(result.accessToken).toBe('mock-access-token');
    expect(mail.enqueueVerification).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(String),
    );
  });

  it('rejects login with invalid credentials', async () => {
    db.user.findUnique.mockResolvedValue(baseUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'test@example.com', password: 'wrongpassword' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logs in with valid credentials and rotates the refresh token', async () => {
    db.user.findUnique.mockResolvedValue({
      ...baseUser,
      refreshTokenHash: 'old-hash',
    });
    db.user.update.mockResolvedValue({});
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result.accessToken).toBe('mock-access-token');
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ refreshTokenHash: expect.any(String) }),
      }),
    );
  });

  it('rejects an invalid refresh token', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(service.refresh('stale-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('invalidates the stored refresh token on logout', async () => {
    db.user.update.mockResolvedValue({});

    await expect(service.logout('user-1')).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { refreshTokenHash: null },
    });
  });

  it('resets the password for a valid reset token', async () => {
    db.user.findFirst.mockResolvedValue(baseUser);
    db.user.update.mockResolvedValue({});

    const result = await service.resetPassword('reset-token', 'newpassword123');

    expect(result.message).toBe('Password reset');
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ resetPasswordToken: null }),
      }),
    );
  });

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
