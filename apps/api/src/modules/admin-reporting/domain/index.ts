export type { AuditLog } from '../../../generated/prisma/client';

export const REPORT_TYPES = [
  'overview',
  'booking',
  'revenue',
  'occupancy',
  'customer',
  'cancellation',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
