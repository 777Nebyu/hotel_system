export const SENSITIVE_USER_FIELDS = [
  'passwordHash',
  'refreshTokenHash',
  'refreshTokenFamily',
  'verificationToken',
  'resetPasswordToken',
  'resetPasswordExpiresAt',
  'loginAttempts',
  'lockedUntil',
] as const;

export type SafeUser<T> = Omit<T, (typeof SENSITIVE_USER_FIELDS)[number]>;
