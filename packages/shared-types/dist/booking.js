"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chapaWebhookSchema = exports.chapaIntentSchema = exports.bankCallbackSchema = exports.verifyOtpSchema = exports.createWalkInBookingSchema = exports.relocateRoomSchema = exports.modifyBookingSchema = exports.lateCheckOutActionSchema = exports.earlyCheckInActionSchema = exports.stayRequestIdParamsSchema = exports.decideStayRequestSchema = exports.createStayRequestSchema = exports.stayRequestStatusSchema = exports.stayRequestTypeSchema = exports.roomHoldIdParamsSchema = exports.createRoomHoldSchema = exports.markCashPaidSchema = exports.cancelRoomSchema = exports.invoiceParamsSchema = exports.mockGatewayCallbackSchema = exports.paymentMethodSchemaInput = exports.manageBookingsQuerySchema = exports.myBookingsQuerySchema = exports.bookingIdParamsSchema = exports.createBookingSchema = exports.bookingGuestSchema = exports.checkoutSchema = exports.bookingSourceSchema = exports.paymentMethodSchema = exports.paymentStatusSchema = exports.bookingStatusSchema = void 0;
const zod_1 = require("zod");
const id = zod_1.z.string().min(1);
const dateOnly = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
exports.bookingStatusSchema = zod_1.z.enum([
    'PENDING',
    'CONFIRMED',
    'CHECKED_IN',
    'CHECKED_OUT',
    'CANCELLED',
    'REJECTED',
    'NO_SHOW',
]);
exports.paymentStatusSchema = zod_1.z.enum([
    'PENDING',
    'PENDING_AT_HOTEL',
    'PROCESSING',
    'OTP_SENT',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'EXPIRED',
    'TIMEOUT',
    'REFUNDED',
]);
exports.paymentMethodSchema = zod_1.z.enum([
    'CREDIT_CARD',
    'PAYPAL',
    'TELEBIRR',
    'CBE_BIRR',
    'CASH',
    'CHAPA',
    'AWASH_BANK',
    'ENAT_BANK',
    'AMHARA_BANK',
    'COOP_BANK',
]);
exports.bookingSourceSchema = zod_1.z.enum(['ONLINE', 'WALK_IN']);
const guestsSchema = zod_1.z.object({
    adults: zod_1.z.coerce.number().int().min(1).max(20).default(1),
    children: zod_1.z.coerce.number().int().min(0).max(10).default(0),
});
const stayRefine = {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
};
exports.checkoutSchema = zod_1.z
    .object({
    hotelId: id,
    roomIds: zod_1.z.array(id).min(1).max(10),
    checkIn: dateOnly,
    checkOut: dateOnly,
    guests: guestsSchema.default({ adults: 1, children: 0 }),
    promoCode: zod_1.z.string().min(3).max(20).optional(),
})
    .refine((d) => d.checkOut > d.checkIn, stayRefine);
exports.bookingGuestSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(1).max(120),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().min(3).max(30).optional(),
    nationality: zod_1.z.string().max(80).optional(),
    idType: zod_1.z
        .enum(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'])
        .or(zod_1.z.string())
        .optional(),
    idNumber: zod_1.z.string().max(50).optional(),
});
exports.createBookingSchema = zod_1.z
    .object({
    hotelId: id,
    roomIds: zod_1.z.array(id).min(1).max(10),
    checkIn: dateOnly,
    checkOut: dateOnly,
    guests: guestsSchema.default({ adults: 1, children: 0 }),
    guestInfos: zod_1.z.array(exports.bookingGuestSchema).min(1).max(50),
    promoCode: zod_1.z.string().min(3).max(20).optional(),
    paymentMethod: exports.paymentMethodSchema.default('CREDIT_CARD'),
    bookingSource: exports.bookingSourceSchema.default('ONLINE'),
})
    .refine((d) => d.checkOut > d.checkIn, stayRefine);
exports.bookingIdParamsSchema = zod_1.z.object({ bookingId: id });
exports.myBookingsQuerySchema = zod_1.z.object({
    scope: zod_1.z.enum(['upcoming', 'past']).optional(),
});
exports.manageBookingsQuerySchema = zod_1.z.object({
    status: exports.bookingStatusSchema.optional(),
    hotelId: id.optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.paymentMethodSchemaInput = zod_1.z.object({
    method: exports.paymentMethodSchema,
    reference: zod_1.z.string().min(1).max(64).optional(),
});
exports.mockGatewayCallbackSchema = zod_1.z.object({
    status: zod_1.z.enum(['SUCCEEDED', 'FAILED']).optional(),
    reference: zod_1.z.string().min(1).max(64).optional(),
    transactionId: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
});
exports.invoiceParamsSchema = zod_1.z.object({ bookingId: id });
exports.cancelRoomSchema = zod_1.z.object({
    roomIds: zod_1.z.array(id).min(1).max(10),
});
exports.markCashPaidSchema = zod_1.z.object({
    reference: zod_1.z.string().min(1).max(64).optional(),
});
exports.createRoomHoldSchema = zod_1.z
    .object({
    roomId: id,
    checkIn: dateOnly,
    checkOut: dateOnly,
})
    .refine((d) => d.checkOut > d.checkIn, stayRefine);
exports.roomHoldIdParamsSchema = zod_1.z.object({ holdId: id });
exports.stayRequestTypeSchema = zod_1.z.enum([
    'EARLY_CHECKIN',
    'LATE_CHECKOUT',
]);
exports.stayRequestStatusSchema = zod_1.z.enum([
    'PENDING',
    'APPROVED',
    'REJECTED',
]);
exports.createStayRequestSchema = zod_1.z.object({
    type: exports.stayRequestTypeSchema,
    requestedTime: zod_1.z.string().max(20).optional(),
    guestConsent: zod_1.z.boolean().default(true),
});
exports.decideStayRequestSchema = zod_1.z.object({
    decision: zod_1.z.enum(['APPROVED', 'REJECTED']),
    decisionNote: zod_1.z.string().max(500).optional(),
});
exports.stayRequestIdParamsSchema = zod_1.z.object({ id });
exports.earlyCheckInActionSchema = zod_1.z.object({
    earlyCheckInFee: zod_1.z.coerce.number().min(0).optional(),
});
exports.lateCheckOutActionSchema = zod_1.z.object({
    lateCheckOutFee: zod_1.z.coerce.number().min(0).optional(),
});
exports.modifyBookingSchema = zod_1.z
    .object({
    checkIn: dateOnly.optional(),
    checkOut: dateOnly.optional(),
    roomIds: zod_1.z.array(id).min(1).max(10).optional(),
    guestInfos: zod_1.z.array(exports.bookingGuestSchema).min(1).max(50).optional(),
    reason: zod_1.z.string().min(3).max(500).optional(),
})
    .refine((d) => (!d.checkIn && !d.checkOut) ||
    (d.checkIn && d.checkOut && d.checkOut > d.checkIn), stayRefine);
exports.relocateRoomSchema = zod_1.z.object({
    oldRoomId: id,
    newRoomId: id,
    reason: zod_1.z.string().min(3).max(500),
});
exports.createWalkInBookingSchema = zod_1.z
    .object({
    hotelId: id,
    roomIds: zod_1.z.array(id).min(1).max(10),
    checkIn: dateOnly,
    checkOut: dateOnly,
    guests: guestsSchema.default({ adults: 1, children: 0 }),
    guestName: zod_1.z.string().min(2).max(120),
    guestEmail: zod_1.z.string().email().optional(),
    guestPhone: zod_1.z.string().min(3).max(30),
    guestIdNumber: zod_1.z.string().min(3).max(50).optional(),
    paymentMethod: exports.paymentMethodSchema.default('CASH'),
    paidImmediately: zod_1.z.boolean().default(true),
    promoCode: zod_1.z.string().min(3).max(20).optional(),
})
    .refine((d) => d.checkOut > d.checkIn, stayRefine);
// ── Chapa Payment Schemas ─────────────────────────────────────────────────────
exports.verifyOtpSchema = zod_1.z.object({
    code: zod_1.z.string().length(6).regex(/^\d{6}$/, 'Must be a 6-digit code'),
});
exports.bankCallbackSchema = zod_1.z.object({
    status: zod_1.z.enum(['AUTHORIZED', 'DECLINED', 'INSUFFICIENT_BALANCE', 'TIMEOUT']),
    bankTransactionId: zod_1.z.string().optional(),
    pin: zod_1.z.string().min(4).max(6).optional(),
});
exports.chapaIntentSchema = zod_1.z.object({
    method: exports.paymentMethodSchema,
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    bankCode: zod_1.z.string().optional(),
    accountNumber: zod_1.z.string().optional(),
});
exports.chapaWebhookSchema = zod_1.z.object({
    tx_ref: zod_1.z.string().min(1),
    status: zod_1.z.enum(['SUCCESS', 'FAILED', 'CANCELLED']),
    amount: zod_1.z.number().positive().optional(),
    currency: zod_1.z.string().default('ETB'),
});
