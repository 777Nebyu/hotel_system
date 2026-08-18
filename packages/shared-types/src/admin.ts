import { z } from 'zod';
import { bookingStatusSchema } from './booking';
import { paymentStatusSchema } from './booking';

const id = z.string().min(1);
const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);
const userRoleSchema = z.enum(['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN']);

export const adminHotelStatusSchema = z.enum([
  'ACTIVE',
  'PENDING',
  'REJECTED',
  'INACTIVE',
]);
export type AdminHotelStatus = z.infer<typeof adminHotelStatusSchema>;

export const adminUsersQuerySchema = z.object({
  page,
  pageSize,
  role: userRoleSchema.optional(),
  search: z.string().max(120).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
});
export type UpdateUserRole = z.infer<typeof updateUserRoleSchema>;

export const setUserActiveSchema = z.object({
  isActive: z.boolean(),
});
export type SetUserActive = z.infer<typeof setUserActiveSchema>;

export const userIdParamsSchema = z.object({ userId: id });
export type UserIdParams = z.infer<typeof userIdParamsSchema>;

export const adminHotelsQuerySchema = z.object({
  page,
  pageSize,
  status: adminHotelStatusSchema.optional(),
  search: z.string().max(120).optional(),
});
export type AdminHotelsQuery = z.infer<typeof adminHotelsQuerySchema>;

export const updateHotelStatusSchema = z.object({
  status: adminHotelStatusSchema,
});
export type UpdateHotelStatus = z.infer<typeof updateHotelStatusSchema>;

export const reassignManagerSchema = z.object({
  managerId: z.string().min(1).nullable(),
});
export type ReassignManager = z.infer<typeof reassignManagerSchema>;

export const adminBookingsQuerySchema = z.object({
  page,
  pageSize,
  status: bookingStatusSchema.optional(),
  hotelId: id.optional(),
  userId: id.optional(),
});
export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;

export const adminPaymentsQuerySchema = z.object({
  page,
  pageSize,
  status: paymentStatusSchema.optional(),
});
export type AdminPaymentsQuery = z.infer<typeof adminPaymentsQuerySchema>;

export const adminReviewsQuerySchema = z.object({
  page,
  pageSize,
  hotelId: id.optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
});
export type AdminReviewsQuery = z.infer<typeof adminReviewsQuerySchema>;

export const settingParamsSchema = z.object({ key: z.string().min(1).max(64) });
export type SettingParams = z.infer<typeof settingParamsSchema>;

export const upsertSettingSchema = z.object({
  value: z.record(z.string(), z.unknown()),
});
export type UpsertSetting = z.infer<typeof upsertSettingSchema>;

export const auditLogsQuerySchema = z.object({
  page,
  pageSize,
  entity: z.string().max(64).optional(),
  action: z.string().max(64).optional(),
  actorId: id.optional(),
});
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;

export const reportParamsSchema = z.object({
  type: z.enum(['booking', 'revenue', 'occupancy', 'customer', 'cancellation']),
});
export type ReportParams = z.infer<typeof reportParamsSchema>;

export const reportQuerySchema = z.object({
  format: z.enum(['pdf', 'excel']).default('pdf'),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;