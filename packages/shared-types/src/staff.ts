import { z } from 'zod';

const id = z.string().min(1);

export const assignStaffSchema = z.object({
  staffId: id,
});
export type AssignStaffInput = z.infer<typeof assignStaffSchema>;

export const staffHotelParamsSchema = z.object({
  hotelId: id,
  staffId: id,
});
export type StaffHotelParams = z.infer<typeof staffHotelParamsSchema>;

export const hotelStaffQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type HotelStaffQuery = z.infer<typeof hotelStaffQuerySchema>;

export const createDisputeSchema = z.object({
  bookingId: id,
  reason: z.string().min(10).max(2000),
});
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

export const resolveDisputeSchema = z.object({
  resolution: z.string().min(5).max(2000),
});
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export const disputeStatusSchema = z.enum([
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'CLOSED',
]);
export type DisputeStatusType = z.infer<typeof disputeStatusSchema>;

export const disputeIdParamsSchema = z.object({ id });
export type DisputeIdParams = z.infer<typeof disputeIdParamsSchema>;

export const disputeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: disputeStatusSchema.optional(),
});
export type DisputeQuery = z.infer<typeof disputeQuerySchema>;

export const requestSuspensionSchema = z.object({
  targetType: z.enum(['USER', 'HOTEL']),
  targetId: id,
  reason: z.string().min(10).max(1000),
});
export type RequestSuspensionInput = z.infer<typeof requestSuspensionSchema>;

export const decideSuspensionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
});
export type DecideSuspensionInput = z.infer<typeof decideSuspensionSchema>;

export const suspensionIdParamsSchema = z.object({ id });
export type SuspensionIdParams = z.infer<typeof suspensionIdParamsSchema>;
