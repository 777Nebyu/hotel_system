import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import type {
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from '@repo/shared-types';
import { User } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  STORAGE_SERVICE,
  type StorageService,
  type UploadedFile,
} from '../../../common/storage/storage';
import { MailProducer } from '../../jobs/mail.producer';
import { SafeUser, SENSITIVE_USER_FIELDS } from '../domain';

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface JwtPayload {
  sub: string;
  email: string;
  role: User['role'];
  hotelId?: string;
  family: string;
}

export interface AuthResult {
  user: SafeUser<User>;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailProducer,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
  ) {}

  private safeUser(user: User): SafeUser<User> {
    const safe: Record<string, unknown> = { ...user };
    for (const field of SENSITIVE_USER_FIELDS) {
      delete safe[field];
    }
    return safe as SafeUser<User>;
  }

  private async resolveHotelId(
    userId: string,
    role: User['role'],
  ): Promise<string | undefined> {
    if (role !== 'MANAGER') return undefined;
    const hotel = await this.db.hotel.findFirst({
      where: { managerId: userId },
      select: { id: true },
    });
    return hotel?.id;
  }

  private async issueTokens(
    user: Pick<User, 'id' | 'email' | 'role'>,
    family?: string,
  ): Promise<Pick<AuthResult, 'accessToken' | 'refreshToken'>> {
    const tokenFamily = family ?? randomUUID();
    const hotelId = await this.resolveHotelId(user.id, user.role);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      family: tokenFamily,
      ...(hotelId ? { hotelId } : {}),
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.config.getOrThrow<string>(
        'jwt.accessTtl',
      ) as JwtSignOptions['expiresIn'],
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.config.getOrThrow<string>(
        'jwt.refreshTtl',
      ) as JwtSignOptions['expiresIn'],
    });

    await this.db.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash: await bcrypt.hash(refreshToken, BCRYPT_ROUNDS),
        refreshTokenFamily: tokenFamily,
      },
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterInput): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const verificationToken = randomBytes(32).toString('hex');
    const user = await this.db.user.create({
      data: {
        email,
        fullName: dto.fullName,
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        verificationToken,
      },
    });

    void this.mail.enqueueVerification(email, verificationToken);

    return { user: this.safeUser(user), ...(await this.issueTokens(user)) };
  }

  async login(dto: LoginInput): Promise<AuthResult> {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid =
      user !== null &&
      (await bcrypt.compare(dto.password, user.passwordHash));

    if (!user || !passwordValid) {
      if (user) {
        const attempts = user.loginAttempts + 1;
        const lockedUntil =
          attempts >= MAX_LOGIN_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_DURATION_MS)
            : null;
        await this.db.user.update({
          where: { id: user.id },
          data: { loginAttempts: attempts, lockedUntil },
        });
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account is not active');
    }

    await this.db.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    return { user: this.safeUser(user), ...(await this.issueTokens(user)) };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.db.user.findUnique({ where: { id: payload.sub } });

    const tokenValid =
      user !== null &&
      user.refreshTokenHash !== null &&
      (await bcrypt.compare(refreshToken, user.refreshTokenHash));

    if (!user || !tokenValid) {
      if (user && payload.family && user.refreshTokenFamily !== null) {
        await this.db.user.update({
          where: { id: user.id },
          data: { refreshTokenHash: null, refreshTokenFamily: null },
        });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (user.refreshTokenFamily !== payload.family) {
      await this.db.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null, refreshTokenFamily: null },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account is not active');
    }

    return {
      user: this.safeUser(user),
      ...(await this.issueTokens(user, payload.family)),
    };
  }

  async logout(id: string): Promise<{ message: string }> {
    await this.db.user.update({
      where: { id },
      data: { refreshTokenHash: null, refreshTokenFamily: null },
    });
    return { message: 'Logged out successfully' };
  }

  async profile(id: string): Promise<SafeUser<User>> {
    return this.safeUser(
      await this.db.user.findUniqueOrThrow({ where: { id } }),
    );
  }

  async updateProfile(
    id: string,
    dto: UpdateProfileInput,
  ): Promise<SafeUser<User>> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id } });
    const data: Partial<Pick<User, 'fullName' | 'phone' | 'passwordHash'>> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.newPassword) {
      if (
        !dto.currentPassword ||
        !(await bcrypt.compare(dto.currentPassword, user.passwordHash))
      ) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      data.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    }
    const updated = await this.db.user.update({ where: { id }, data });
    return this.safeUser(updated);
  }

  async updateProfilePhoto(
    id: string,
    file: UploadedFile,
  ): Promise<SafeUser<User>> {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }
    const existing = await this.db.user.findUniqueOrThrow({ where: { id } });
    const uploaded = await this.storage.upload(file, 'profiles');
    const user = await this.db.user.update({
      where: { id },
      data: { profilePhotoUrl: uploaded.url },
    });
    if (existing.profilePhotoUrl && existing.profilePhotoUrl !== uploaded.url) {
      await this.storage.remove({
        url: existing.profilePhotoUrl,
        publicId: null,
      });
    }
    return this.safeUser(user);
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    await this.db.user.update({
      where: { verificationToken: token },
      data: { emailVerifiedAt: new Date(), verificationToken: null },
    });
    return { message: 'Email verified' };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user) {
      const resetPasswordToken = randomBytes(32).toString('hex');
      await this.db.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken,
          resetPasswordExpiresAt: new Date(Date.now() + 3600000),
        },
      });

      void this.mail.enqueuePasswordReset(user.email, resetPasswordToken);
    }
    return { message: 'If the account exists, a reset email will be sent' };
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.db.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiresAt: { gt: new Date() },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    await this.db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        refreshTokenHash: null,
        refreshTokenFamily: null,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });
    return { message: 'Password reset' };
  }
}
