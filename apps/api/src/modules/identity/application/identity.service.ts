import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import type {
  DeactivateAccountInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from '@repo/shared-types';
import { User } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
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

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

export function parseDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Unknown Device';
  let os = 'Unknown OS';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os/i.test(userAgent)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  let browser = 'Browser';
  if (/edg/i.test(userAgent)) browser = 'Edge';
  else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
  else if (/safari/i.test(userAgent)) browser = 'Safari';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';

  return `${browser} on ${os}`;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: User['role'];
  hotelId?: string;
  family: string;
  sessionId?: string;
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
    @Optional()
    private readonly audit?: AuditService,
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
    meta?: SessionMeta,
  ): Promise<Pick<AuthResult, 'accessToken' | 'refreshToken'>> {
    const tokenFamily = family ?? randomUUID();
    const hotelId = await this.resolveHotelId(user.id, user.role);

    let sessionId = meta?.sessionId;
    if (this.db.userSession) {
      if (sessionId) {
        await this.db.userSession.update({
          where: { id: sessionId },
          data: {
            family: tokenFamily,
            lastActiveAt: new Date(),
            ...(meta?.ipAddress ? { ipAddress: meta.ipAddress } : {}),
            ...(meta?.userAgent ? { userAgent: meta.userAgent } : {}),
          },
        });
      } else {
        const session = await this.db.userSession.create({
          data: {
            userId: user.id,
            family: tokenFamily,
            refreshTokenHash: '',
            deviceName: parseDeviceName(meta?.userAgent),
            userAgent: meta?.userAgent,
            ipAddress: meta?.ipAddress,
            lastActiveAt: new Date(),
          },
        });
        sessionId = session.id;
      }
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      family: tokenFamily,
      ...(sessionId ? { sessionId } : {}),
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

    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);

    if (sessionId && this.db.userSession) {
      await this.db.userSession.update({
        where: { id: sessionId },
        data: { refreshTokenHash },
      });
    }

    await this.db.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash,
        refreshTokenFamily: tokenFamily,
      },
    });

    return { accessToken, refreshToken };
  }

  async register(
    dto: RegisterInput,
    meta?: SessionMeta,
  ): Promise<AuthResult> {
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
        status: 'EMAIL_UNVERIFIED',
      },
    });

    void this.mail.enqueueVerification(email, verificationToken);

    return {
      user: this.safeUser(user),
      ...(await this.issueTokens(user, undefined, meta)),
    };
  }

  async login(
    dto: LoginInput,
    meta?: SessionMeta,
  ): Promise<AuthResult> {
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

    if (user.status === 'DELETED') {
      throw new ForbiddenException('This account has been deleted');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('This account has been suspended');
    }

    if (user.status === 'DEACTIVATED' || !user.isActive) {
      if (user.deletionScheduledFor && user.deletionScheduledFor > new Date()) {
        await this.db.user.update({
          where: { id: user.id },
          data: {
            status: 'ACTIVE',
            isActive: true,
            deletionScheduledFor: null,
          },
        });
        await this.audit?.record(user.id, 'USER_REACTIVATED', 'User', user.id);
      } else {
        throw new ForbiddenException('This account is not active');
      }
    }

    await this.db.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    return {
      user: this.safeUser(user),
      ...(await this.issueTokens(user, undefined, meta)),
    };
  }

  async refresh(
    refreshToken: string,
    meta?: SessionMeta,
  ): Promise<AuthResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.db.user.findUnique({ where: { id: payload.sub } });

    if (payload.sessionId && this.db.userSession) {
      const session = await this.db.userSession.findUnique({
        where: { id: payload.sessionId },
      });

      if (
        !session ||
        session.userId !== user?.id ||
        session.revokedAt !== null
      ) {
        throw new UnauthorizedException(
          'Session has been revoked or is invalid',
        );
      }

      const tokenValid =
        session.refreshTokenHash !== null &&
        (await bcrypt.compare(refreshToken, session.refreshTokenHash));

      if (!tokenValid || session.family !== payload.family) {
        await this.db.userSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Invalid refresh token');
      }
    } else {
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
    }

    if (
      !user ||
      user.status === 'DELETED' ||
      user.status === 'SUSPENDED' ||
      !user.isActive
    ) {
      throw new ForbiddenException('This account is not active');
    }

    return {
      user: this.safeUser(user),
      ...(await this.issueTokens(user, payload.family, {
        ...meta,
        sessionId: payload.sessionId,
      })),
    };
  }

  async logout(id: string, sessionId?: string): Promise<{ message: string }> {
    if (sessionId && this.db.userSession) {
      await this.db.userSession.updateMany({
        where: { id: sessionId, userId: id },
        data: { revokedAt: new Date() },
      });
    }
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
      data: {
        emailVerifiedAt: new Date(),
        verificationToken: null,
        status: 'ACTIVE',
      },
    });
    return { message: 'Email verified' };
  }

  async deactivateAccount(
    userId: string,
    dto?: DeactivateAccountInput,
  ): Promise<{ message: string }> {
    const scheduled = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.db.user.update({
      where: { id: userId },
      data: {
        status: 'DEACTIVATED',
        isActive: false,
        deletionScheduledFor: scheduled,
        refreshTokenHash: null,
        refreshTokenFamily: null,
      },
    });

    await this.db.booking.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    await this.audit?.record(userId, 'USER_DEACTIVATED', 'User', userId, {
      reason: dto?.reason,
      deletionScheduledFor: scheduled,
    });

    return {
      message:
        'Account deactivated. You have 30 days to log in to reactivate before deletion.',
    };
  }

  async deleteAccount(userId: string): Promise<{ message: string }> {
    return this.deactivateAccount(userId, {
      reason: 'User requested account deletion',
    });
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

  async listSessions(userId: string, currentSessionId?: string) {
    if (!this.db.userSession) return [];
    const sessions = await this.db.userSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastActiveAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      deviceName: s.deviceName || 'Unknown Device',
      ipAddress: s.ipAddress,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ message: string }> {
    if (!this.db.userSession) {
      return { message: 'Session revoked successfully' };
    }
    const session = await this.db.userSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    await this.db.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { message: 'Session revoked successfully' };
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<{ message: string }> {
    if (!this.db.userSession) {
      return { message: 'All other sessions revoked successfully' };
    }
    await this.db.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return { message: 'All other sessions revoked successfully' };
  }
}
