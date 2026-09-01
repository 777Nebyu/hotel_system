/**
 * Fields stripped from any User object before it leaves the API layer.
 * Extend this list if new sensitive columns are added to the User model.
 */
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
