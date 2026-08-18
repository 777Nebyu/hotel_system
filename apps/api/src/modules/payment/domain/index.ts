export type { Payment, PaymentStatus } from '../../../generated/prisma/client';

export const PAYMENT_METHODS = [
  'CREDIT_CARD',
  'PAYPAL',
  'TELEBIRR',
  'CBE_BIRR',
  'CASH',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export * from './payment-gateway';