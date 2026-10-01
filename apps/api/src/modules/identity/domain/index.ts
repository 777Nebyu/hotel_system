export const SENSITIVE_USER_FIELDS = [
  'passwordHash',
  'googleId',
  'refreshTokenHash',
  'refreshTokenFamily',
  'verificationToken',
  'verificationTokenExpiresAt',
  'resetPasswordToken',
  'resetPasswordExpiresAt',
  'loginAttempts',
  'lockedUntil',
  'mfaSecretEncrypted',
  'mfaPendingSecretEncrypted',
  'mfaChallengeHash',
  'mfaChallengeExpiresAt',
] as const;

export type SafeUser<T> = Omit<T, (typeof SENSITIVE_USER_FIELDS)[number]>;
