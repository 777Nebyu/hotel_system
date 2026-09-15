export type { AuditLog } from '../../../generated/prisma/client';

export const REPORT_TYPES = [
  'booking',
  'revenue',
  'occupancy',
  'customer',
  'cancellation',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
