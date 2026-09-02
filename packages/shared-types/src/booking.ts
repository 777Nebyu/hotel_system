import { z } from 'zod';

const id = z.string().min(1);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const bookingStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'REJECTED',
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const paymentStatusSchema = z.enum([
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentMethodSchema = z.enum([
  'CREDIT_CARD',
  'PAYPAL',
  'TELEBIRR',
  'CBE_BIRR',
  'CASH',
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const bookingSourceSchema = z.enum(['ONLINE', 'WALK_IN']);
export type BookingSource = z.infer<typeof bookingSourceSchema>;

const guestsSchema = z.object({
  adults: z.coerce.number().int().min(1).max(20).default(1),
  children: z.coerce.number().int().min(0).max(10).default(0),
});

const stayRefine = {
  message: 'checkOut must be after checkIn',
  path: ['checkOut'],
};

export const checkoutSchema = z
  .object({
    hotelId: id,
    roomIds: z.array(id).min(1).max(10),
    checkIn: dateOnly,
    checkOut: dateOnly,
    guests: guestsSchema.default({ adults: 1, children: 0 }),
    promoCode: z.string().min(3).max(20).optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, stayRefine);
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const bookingGuestSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().optional(),
  phone: z.string().min(3).max(30).optional(),
});
export type BookingGuest = z.infer<typeof bookingGuestSchema>;

export const createBookingSchema = z
  .object({
    hotelId: id,
    roomIds: z.array(id).min(1).max(10),
    checkIn: dateOnly,
    checkOut: dateOnly,
    guests: guestsSchema.default({ adults: 1, children: 0 }),
    guestInfos: z.array(bookingGuestSchema).min(1).max(50),
    promoCode: z.string().min(3).max(20).optional(),
    paymentMethod: paymentMethodSchema.default('CREDIT_CARD'),
    bookingSource: bookingSourceSchema.default('ONLINE'),
  })
  .refine((d) => d.checkOut > d.checkIn, stayRefine);
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const bookingIdParamsSchema = z.object({ bookingId: id });
export type BookingIdParams = z.infer<typeof bookingIdParamsSchema>;

export const myBookingsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).optional(),
});
export type MyBookingsQuery = z.infer<typeof myBookingsQuerySchema>;

export const manageBookingsQuerySchema = z.object({
  status: bookingStatusSchema.optional(),
  hotelId: id.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ManageBookingsQuery = z.infer<typeof manageBookingsQuerySchema>;

export const paymentMethodSchemaInput = z.object({
  method: paymentMethodSchema,
  reference: z.string().min(1).max(64).optional(),
});
export type PaymentMethodInput = z.infer<typeof paymentMethodSchemaInput>;

export const mockGatewayCallbackSchema = z.object({
  reference: z.string().min(1).max(64).optional(),
  transactionId: z.string().optional(),
  message: z.string().optional(),
});
export type MockGatewayCallback = z.infer<typeof mockGatewayCallbackSchema>;

export const invoiceParamsSchema = z.object({ bookingId: id });
export type InvoiceParams = z.infer<typeof invoiceParamsSchema>;

export const cancelRoomSchema = z.object({
  roomIds: z.array(id).min(1).max(10),
});
export type CancelRoomInput = z.infer<typeof cancelRoomSchema>;

export const markCashPaidSchema = z.object({
  reference: z.string().min(1).max(64).optional(),
});
export type MarkCashPaidInput = z.infer<typeof markCashPaidSchema>;

export const createRoomHoldSchema = z
  .object({
    roomId: id,
    checkIn: dateOnly,
    checkOut: dateOnly,
  })
  .refine((d) => d.checkOut > d.checkIn, stayRefine);
export type CreateRoomHoldInput = z.infer<typeof createRoomHoldSchema>;

export const roomHoldIdParamsSchema = z.object({ holdId: id });
export type RoomHoldIdParams = z.infer<typeof roomHoldIdParamsSchema>;

export const stayRequestTypeSchema = z.enum([
  'EARLY_CHECKIN',
  'LATE_CHECKOUT',
]);
export type StayRequestType = z.infer<typeof stayRequestTypeSchema>;

export const stayRequestStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);
export type StayRequestStatus = z.infer<typeof stayRequestStatusSchema>;

export const createStayRequestSchema = z.object({
  type: stayRequestTypeSchema,
  requestedTime: z.string().max(20).optional(),
  guestConsent: z.boolean().default(true),
});
export type CreateStayRequestInput = z.infer<typeof createStayRequestSchema>;

export const decideStayRequestSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  decisionNote: z.string().max(500).optional(),
});
export type DecideStayRequestInput = z.infer<typeof decideStayRequestSchema>;

export const stayRequestIdParamsSchema = z.object({ id });
export type StayRequestIdParams = z.infer<typeof stayRequestIdParamsSchema>;

export const earlyCheckInActionSchema = z.object({
  earlyCheckInFee: z.coerce.number().min(0).optional(),
});
export type EarlyCheckInActionInput = z.infer<typeof earlyCheckInActionSchema>;

export const lateCheckOutActionSchema = z.object({
  lateCheckOutFee: z.coerce.number().min(0).optional(),
});
export type LateCheckOutActionInput = z.infer<typeof lateCheckOutActionSchema>;