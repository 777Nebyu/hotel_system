export const SENSITIVE_USER_FIELDS = [
  'passwordHash',
  'refreshTokenHash',
  'verificationToken',
  'resetPasswordToken',
  'resetPasswordExpiresAt',
] as const;

export type SafeUser<T> = Omit<T, (typeof SENSITIVE_USER_FIELDS)[number]>;
