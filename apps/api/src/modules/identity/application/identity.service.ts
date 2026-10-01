import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  hashPassword,
  isLegacyPasswordHash,
  verifyPassword,
} from '../../../common/security/password-hasher';
import { OAuth2Client } from 'google-auth-library';
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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserEventNames, UserRegisteredEvent } from '../../events/user.events';
import { MailProducer } from '../../jobs/mail.producer';
import { SafeUser, SENSITIVE_USER_FIELDS } from '../domain';
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateTotpSecret,
  hashMfaChallenge,
  verifyTotpCode,
} from '../../../common/security/mfa';

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
  mfaRequired?: boolean;
  challengeToken?: string;
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailProducer,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
    @Optional()
    private readonly audit?: AuditService,
    @Optional()
    private readonly emitter?: EventEmitter2,
  ) { }

  private safeUser(user: User): SafeUser<User> {
    const safe: Record<string, unknown> = { ...user };
    for (const field of SENSITIVE_USER_FIELDS) {
      delete safe[field];
    }
    // emailVerifiedAt is canonical; keep the legacy boolean response derived
    // from it so older clients cannot observe a contradictory state.
    safe.emailVerified = user.emailVerifiedAt !== null;
    return safe as SafeUser<User>;
  }

  private async resolveHotelId(
    userId: string,
    role: User['role'],
  ): Promise<string | undefined> {
    if (role === 'MANAGER') {
      const hotel = await this.db.hotel.findFirst({
        where: { managerId: userId },
        select: { id: true },
      });
      return hotel?.id;
    }
    if (role === 'STAFF') {
      const assignment = await this.db.staffHotel.findFirst({
        where: { staffId: userId },
        orderBy: { assignedAt: 'asc' },
        select: { hotelId: true },
      });
      return assignment?.hotelId;
    }
    return undefined;
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

  private mfaKey(): string {
    const key = this.config.get<string>('mfaEncryptionKey');
    if (!key || key.length < 32) {
      throw new BadRequestException('MFA is not configured on this server');
    }
    return key;
  }

  private assertAdmin(user: Pick<User, 'role'>) {
    if (user.role !== 'ADMIN')
      throw new ForbiddenException(
        'Admin MFA is only available to system administrators',
      );
  }

  async enrollMfa(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    this.assertAdmin(user);
    const secret = generateTotpSecret();
    await this.db.user.update({
      where: { id: userId },
      data: {
        mfaPendingSecretEncrypted: encryptMfaSecret(secret, this.mfaKey()),
      },
    });
    const issuer = encodeURIComponent('YayeTech Hotel');
    const account = encodeURIComponent(user.email);
    return {
      secret,
      otpauthUrl: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}`,
    };
  }

  async enableMfa(userId: string, code: string): Promise<{ enabled: true }> {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    this.assertAdmin(user);
    if (!user.mfaPendingSecretEncrypted)
      throw new BadRequestException('Start MFA enrollment first');
    let secret: string;
    try {
      secret = decryptMfaSecret(user.mfaPendingSecretEncrypted, this.mfaKey());
    } catch {
      throw new BadRequestException('MFA enrollment is invalid');
    }
    if (!verifyTotpCode(secret, code))
      throw new UnauthorizedException('Invalid MFA code');
    await this.db.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecretEncrypted: user.mfaPendingSecretEncrypted,
        mfaPendingSecretEncrypted: null,
      },
    });
    await this.audit?.record(userId, 'MFA_ENABLED', 'User', userId);
    return { enabled: true };
  }

  async disableMfa(userId: string, code: string): Promise<{ enabled: false }> {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    this.assertAdmin(user);
    if (!user.mfaEnabled || !user.mfaSecretEncrypted) return { enabled: false };
    let secret: string;
    try {
      secret = decryptMfaSecret(user.mfaSecretEncrypted, this.mfaKey());
    } catch {
      throw new BadRequestException('MFA configuration is invalid');
    }
    if (!verifyTotpCode(secret, code))
      throw new UnauthorizedException('Invalid MFA code');
    await this.db.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        mfaPendingSecretEncrypted: null,
      },
    });
    await this.audit?.record(userId, 'MFA_DISABLED', 'User', userId);
    return { enabled: false };
  }

  private async createMfaChallenge(user: User): Promise<AuthResult> {
    const challengeToken = randomBytes(32).toString('hex');
    await this.db.user.update({
      where: { id: user.id },
      data: {
        mfaChallengeHash: hashMfaChallenge(challengeToken),
        mfaChallengeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    return {
      user: this.safeUser(user),
      accessToken: '',
      refreshToken: '',
      mfaRequired: true,
      challengeToken,
    };
  }

  async verifyMfa(
    challengeToken: string,
    code: string,
    meta?: SessionMeta,
  ): Promise<AuthResult> {
    const user = await this.db.user.findFirst({
      where: {
        mfaChallengeHash: hashMfaChallenge(challengeToken),
        mfaChallengeExpiresAt: { gt: new Date() },
      },
    });
    if (
      !user ||
      user.role !== 'ADMIN' ||
      !user.mfaEnabled ||
      !user.mfaSecretEncrypted
    ) {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }
    let secret: string;
    try {
      secret = decryptMfaSecret(user.mfaSecretEncrypted, this.mfaKey());
    } catch {
      throw new UnauthorizedException('Invalid MFA configuration');
    }
    if (!verifyTotpCode(secret, code))
      throw new UnauthorizedException('Invalid MFA code');
    await this.db.user.update({
      where: { id: user.id },
      data: {
        mfaChallengeHash: null,
        mfaChallengeExpiresAt: null,
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
    await this.audit?.record(user.id, 'MFA_LOGIN', 'User', user.id);
    return {
      user: this.safeUser(user),
      ...(await this.issueTokens(user, undefined, meta)),
    };
  }

  async register(dto: RegisterInput, meta?: SessionMeta): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ); // 24-hour expiry
    const user = await this.db.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        passwordHash: await hashPassword(dto.password),
        emailVerified: false,
        verificationToken,
        verificationTokenExpiresAt,
        status: 'EMAIL_UNVERIFIED',
      },
    });

    void this.mail.enqueueVerification(email, verificationToken);
    // Note: Welcome email is only sent after real email verification is completed
    this.emitter?.emit(
      UserEventNames.REGISTERED,
      new UserRegisteredEvent(
        user.id,
        user.email,
        user.fullName,
        verificationToken,
      ),
    );

    return {
      user: this.safeUser(user),
      accessToken: '',
      refreshToken: '',
    };
  }

  async login(dto: LoginInput, meta?: SessionMeta): Promise<AuthResult> {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid =
      user !== null && (await verifyPassword(dto.password, user.passwordHash));

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

    // Portal selection narrows where an account may enter; it never grants a
    // role. The role embedded in the server-issued token remains authoritative.
    if (dto.portal) {
      const allowed =
        (dto.portal === 'CUSTOMER' && user.role === 'CUSTOMER') ||
        (dto.portal === 'STAFF' &&
          (user.role === 'STAFF' || user.role === 'MANAGER')) ||
        (dto.portal === 'ADMIN' && user.role === 'ADMIN');
      if (!allowed)
        throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'DELETED') {
      throw new ForbiddenException('This account has been deleted');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('This account has been suspended');
    }

    if (!user.emailVerifiedAt || user.status === 'EMAIL_UNVERIFIED') {
      throw new ForbiddenException(
        'Please verify your email address before signing in. Check your inbox for the verification link.',
      );
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

    if (user.role === 'ADMIN' && user.mfaEnabled) {
      return this.createMfaChallenge(user);
    }

    // Transparently migrate legacy bcrypt accounts after a valid login.
    if (isLegacyPasswordHash(user.passwordHash)) {
      await this.db.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(dto.password) },
      });
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

  async googleAuth(
    dto: {
      credential?: string;
      email?: string;
      fullName?: string;
      googleId?: string;
    },
    meta?: SessionMeta,
  ): Promise<AuthResult> {
    // Never trust an email or Google ID supplied by the client. The Google ID
    // token is the proof that Google controls the mailbox and that the email
    // claim is authentic. Without it, marking the account verified would make
    // a format-only email check equivalent to ownership verification.
    if (!dto.credential) {
      throw new BadRequestException(
        'A verified Google credential is required for Google sign-in',
      );
    }

    let email: string;
    let subject = '';
    let fullName = 'Google Guest';
    let profilePhotoUrl: string | undefined;
    try {
      // Pin the token to this app's client id so a valid Google ID token
      // minted for some other application cannot be replayed here.
      const configuredAudiences = this.config.get<string[]>('googleClientIds');
      const legacyAudience = this.config.get<string>('googleClientId');
      const audiences = configuredAudiences?.length
        ? configuredAudiences
        : legacyAudience
          ? [legacyAudience]
          : undefined;
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.credential,
        ...(audiences?.length
          ? { audience: audiences.length === 1 ? audiences[0] : audiences }
          : {}),
      });
      const payload = ticket.getPayload();
      if (!payload?.email || payload.email_verified !== true) {
        throw new BadRequestException(
          'Google did not provide a verified email address',
        );
      }
      email = payload.email;
      subject = typeof payload.sub === 'string' ? payload.sub : '';
      fullName = payload.name || payload.given_name || fullName;
      profilePhotoUrl = payload.picture || undefined;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Failed to verify Google credential token: ${error}`);
      throw new UnauthorizedException('Invalid Google credential');
    }

    email = email.toLowerCase().trim();

    // Google's subject (sub) is the only claim that survives an address change
    // or a recycled mailbox, so it is what accounts are bound to. The email
    // claim stays mandatory above, but it is no longer the lookup key.
    if (!subject) {
      throw new UnauthorizedException('Invalid Google credential');
    }

    let user = await this.db.user.findUnique({ where: { googleId: subject } });

    if (!user) {
      const byEmail = await this.db.user.findUnique({ where: { email } });

      if (byEmail?.googleId && byEmail.googleId !== subject) {
        // The address resolves to a different Google identity than the one
        // already bound to this account. Honouring it would hand the account
        // to whichever Google identity claims the mailbox today.
        this.logger.warn(
          `Refusing Google sign-in for ${email}: token subject ${subject} is not the bound subject`,
        );
        throw new UnauthorizedException(
          'This email address is linked to a different Google account',
        );
      }

      if (byEmail) {
        user = byEmail;
        if (!byEmail.googleId) {
          // First Google sign-in for an account that predates subject binding.
          user = await this.db.user.update({
            where: { id: byEmail.id },
            data: { googleId: subject },
          });
        }
      }
    }

    if (!user) {
      const randomPassword = randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(randomPassword);

      user = await this.db.user.create({
        data: {
          email,
          googleId: subject,
          fullName,
          passwordHash,
          profilePhotoUrl: profilePhotoUrl ?? null,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      });

      this.emitter?.emit(
        UserEventNames.REGISTERED,
        new UserRegisteredEvent(user.id, user.email, user.fullName, ''),
      );

      void this.mail.enqueueWelcome(user.email, user.fullName);
    } else {
      if (!user.emailVerifiedAt || user.status === 'EMAIL_UNVERIFIED') {
        user = await this.db.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
            status: 'ACTIVE',
            verificationToken: null,
            verificationTokenExpiresAt: null,
            profilePhotoUrl: user.profilePhotoUrl ?? profilePhotoUrl ?? null,
          },
        });
      }

      if (
        user.status === 'DEACTIVATED' ||
        user.status === 'SUSPENDED' ||
        !user.isActive
      ) {
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
    }

    if (user.role === 'ADMIN' && user.mfaEnabled) {
      return this.createMfaChallenge(user);
    }

    return {
      user: this.safeUser(user),
      ...(await this.issueTokens(user, undefined, meta)),
    };
  }

  async refresh(refreshToken: string, meta?: SessionMeta): Promise<AuthResult> {
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
        !(await verifyPassword(dto.currentPassword, user.passwordHash))
      ) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      data.passwordHash = await hashPassword(dto.newPassword);
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

  async verifyEmail(
    token: string,
  ): Promise<{ message: string; verified: boolean }> {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.db.user.findFirst({
      where: { verificationToken: token },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    if (
      user.verificationTokenExpiresAt &&
      user.verificationTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Verification link has expired. Please request a new verification link.',
      );
    }

    await this.db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        verificationToken: null,
        verificationTokenExpiresAt: null,
        status: user.status === 'EMAIL_UNVERIFIED' ? 'ACTIVE' : user.status,
      },
    });

    // Verification link clicked & verified: now enqueue the welcome email
    void this.mail.enqueueWelcome(user.email, user.fullName);

    return { message: 'Email verified successfully', verified: true };
  }

  async resendVerificationEmail(
    emailInput: string,
  ): Promise<{ message: string }> {
    const email = emailInput.toLowerCase().trim();
    const user = await this.db.user.findUnique({ where: { email } });

    // Protect against account enumeration
    if (!user) {
      return {
        message:
          'If an unverified account exists, a new verification link has been sent.',
      };
    }

    if (user.emailVerifiedAt && user.status !== 'EMAIL_UNVERIFIED') {
      return { message: 'This email is already verified. You can sign in.' };
    }

    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    await this.db.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiresAt,
      },
    });

    void this.mail.enqueueVerification(email, verificationToken);

    return {
      message:
        'If an unverified account exists, a new verification link has been sent.',
    };
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
        passwordHash: await hashPassword(password),
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        refreshTokenHash: null,
        refreshTokenFamily: null,
        loginAttempts: 0,
        lockedUntil: null,
        // A password-reset token proves access to the reset message, but it is
        // not the registration-email verification link. Preserve the latter
        // and keep an unverified account unverified until that link is clicked.
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
