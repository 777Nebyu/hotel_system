import { z } from 'zod';
export declare const bookingStatusSchema: z.ZodEnum<["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "REJECTED", "NO_SHOW"]>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export declare const paymentStatusSchema: z.ZodEnum<["PENDING", "PENDING_AT_HOTEL", "PROCESSING", "OTP_SENT", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "TIMEOUT", "REFUNDED"]>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export declare const paymentMethodSchema: z.ZodEnum<["CREDIT_CARD", "PAYPAL", "TELEBIRR", "CBE_BIRR", "CASH", "CHAPA", "AWASH_BANK", "ENAT_BANK", "AMHARA_BANK", "COOP_BANK"]>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export declare const bookingSourceSchema: z.ZodEnum<["ONLINE", "WALK_IN"]>;
export type BookingSource = z.infer<typeof bookingSourceSchema>;
export declare const checkoutSchema: z.ZodEffects<z.ZodObject<{
    hotelId: z.ZodString;
    roomIds: z.ZodArray<z.ZodString, "many">;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    guests: z.ZodDefault<z.ZodObject<{
        adults: z.ZodDefault<z.ZodNumber>;
        children: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        adults: number;
        children: number;
    }, {
        adults?: number | undefined;
        children?: number | undefined;
    }>>;
    promoCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guests: {
        adults: number;
        children: number;
    };
    promoCode?: string | undefined;
}, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guests?: {
        adults?: number | undefined;
        children?: number | undefined;
    } | undefined;
    promoCode?: string | undefined;
}>, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guests: {
        adults: number;
        children: number;
    };
    promoCode?: string | undefined;
}, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guests?: {
        adults?: number | undefined;
        children?: number | undefined;
    } | undefined;
    promoCode?: string | undefined;
}>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export declare const bookingGuestSchema: z.ZodObject<{
    fullName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    nationality: z.ZodOptional<z.ZodString>;
    idType: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"]>, z.ZodString]>>;
    idNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    email: string;
    phone?: string | undefined;
    nationality?: string | undefined;
    idType?: string | undefined;
    idNumber?: string | undefined;
}, {
    fullName: string;
    email: string;
    phone?: string | undefined;
    nationality?: string | undefined;
    idType?: string | undefined;
    idNumber?: string | undefined;
}>;
export type BookingGuest = z.infer<typeof bookingGuestSchema>;
export declare const createBookingSchema: z.ZodEffects<z.ZodObject<{
    hotelId: z.ZodString;
    roomIds: z.ZodArray<z.ZodString, "many">;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    guests: z.ZodDefault<z.ZodObject<{
        adults: z.ZodDefault<z.ZodNumber>;
        children: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        adults: number;
        children: number;
    }, {
        adults?: number | undefined;
        children?: number | undefined;
    }>>;
    guestInfos: z.ZodArray<z.ZodObject<{
        fullName: z.ZodString;
        email: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
        nationality: z.ZodOptional<z.ZodString>;
        idType: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"]>, z.ZodString]>>;
        idNumber: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }, {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }>, "many">;
    promoCode: z.ZodOptional<z.ZodString>;
    paymentMethod: z.ZodDefault<z.ZodEnum<["CREDIT_CARD", "PAYPAL", "TELEBIRR", "CBE_BIRR", "CASH", "CHAPA", "AWASH_BANK", "ENAT_BANK", "AMHARA_BANK", "COOP_BANK"]>>;
    bookingSource: z.ZodDefault<z.ZodEnum<["ONLINE", "WALK_IN"]>>;
}, "strip", z.ZodTypeAny, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guests: {
        adults: number;
        children: number;
    };
    guestInfos: {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }[];
    paymentMethod: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK";
    bookingSource: "ONLINE" | "WALK_IN";
    promoCode?: string | undefined;
}, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guestInfos: {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }[];
    guests?: {
        adults?: number | undefined;
        children?: number | undefined;
    } | undefined;
    promoCode?: string | undefined;
    paymentMethod?: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK" | undefined;
    bookingSource?: "ONLINE" | "WALK_IN" | undefined;
}>, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guests: {
        adults: number;
        children: number;
    };
    guestInfos: {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }[];
    paymentMethod: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK";
    bookingSource: "ONLINE" | "WALK_IN";
    promoCode?: string | undefined;
}, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guestInfos: {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }[];
    guests?: {
        adults?: number | undefined;
        children?: number | undefined;
    } | undefined;
    promoCode?: string | undefined;
    paymentMethod?: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK" | undefined;
    bookingSource?: "ONLINE" | "WALK_IN" | undefined;
}>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export declare const bookingIdParamsSchema: z.ZodObject<{
    bookingId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    bookingId: string;
}, {
    bookingId: string;
}>;
export type BookingIdParams = z.infer<typeof bookingIdParamsSchema>;
export declare const myBookingsQuerySchema: z.ZodObject<{
    scope: z.ZodOptional<z.ZodEnum<["upcoming", "past"]>>;
}, "strip", z.ZodTypeAny, {
    scope?: "upcoming" | "past" | undefined;
}, {
    scope?: "upcoming" | "past" | undefined;
}>;
export type MyBookingsQuery = z.infer<typeof myBookingsQuerySchema>;
export declare const manageBookingsQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "REJECTED", "NO_SHOW"]>>;
    hotelId: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "REJECTED" | "NO_SHOW" | undefined;
    hotelId?: string | undefined;
}, {
    status?: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "REJECTED" | "NO_SHOW" | undefined;
    hotelId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type ManageBookingsQuery = z.infer<typeof manageBookingsQuerySchema>;
export declare const paymentMethodSchemaInput: z.ZodObject<{
    method: z.ZodEnum<["CREDIT_CARD", "PAYPAL", "TELEBIRR", "CBE_BIRR", "CASH", "CHAPA", "AWASH_BANK", "ENAT_BANK", "AMHARA_BANK", "COOP_BANK"]>;
    reference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    method: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK";
    reference?: string | undefined;
}, {
    method: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK";
    reference?: string | undefined;
}>;
export type PaymentMethodInput = z.infer<typeof paymentMethodSchemaInput>;
export declare const mockGatewayCallbackSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["SUCCEEDED", "FAILED"]>>;
    reference: z.ZodOptional<z.ZodString>;
    transactionId: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message?: string | undefined;
    status?: "SUCCEEDED" | "FAILED" | undefined;
    reference?: string | undefined;
    transactionId?: string | undefined;
}, {
    message?: string | undefined;
    status?: "SUCCEEDED" | "FAILED" | undefined;
    reference?: string | undefined;
    transactionId?: string | undefined;
}>;
export type MockGatewayCallback = z.infer<typeof mockGatewayCallbackSchema>;
export declare const invoiceParamsSchema: z.ZodObject<{
    bookingId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    bookingId: string;
}, {
    bookingId: string;
}>;
export type InvoiceParams = z.infer<typeof invoiceParamsSchema>;
export declare const cancelRoomSchema: z.ZodObject<{
    roomIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    roomIds: string[];
}, {
    roomIds: string[];
}>;
export type CancelRoomInput = z.infer<typeof cancelRoomSchema>;
export declare const markCashPaidSchema: z.ZodObject<{
    reference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reference?: string | undefined;
}, {
    reference?: string | undefined;
}>;
export type MarkCashPaidInput = z.infer<typeof markCashPaidSchema>;
export declare const createRoomHoldSchema: z.ZodEffects<z.ZodObject<{
    roomId: z.ZodString;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
}, "strip", z.ZodTypeAny, {
    checkOut: string;
    checkIn: string;
    roomId: string;
}, {
    checkOut: string;
    checkIn: string;
    roomId: string;
}>, {
    checkOut: string;
    checkIn: string;
    roomId: string;
}, {
    checkOut: string;
    checkIn: string;
    roomId: string;
}>;
export type CreateRoomHoldInput = z.infer<typeof createRoomHoldSchema>;
export declare const roomHoldIdParamsSchema: z.ZodObject<{
    holdId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    holdId: string;
}, {
    holdId: string;
}>;
export type RoomHoldIdParams = z.infer<typeof roomHoldIdParamsSchema>;
export declare const stayRequestTypeSchema: z.ZodEnum<["EARLY_CHECKIN", "LATE_CHECKOUT"]>;
export type StayRequestType = z.infer<typeof stayRequestTypeSchema>;
export declare const stayRequestStatusSchema: z.ZodEnum<["PENDING", "APPROVED", "REJECTED"]>;
export type StayRequestStatus = z.infer<typeof stayRequestStatusSchema>;
export declare const createStayRequestSchema: z.ZodObject<{
    type: z.ZodEnum<["EARLY_CHECKIN", "LATE_CHECKOUT"]>;
    requestedTime: z.ZodOptional<z.ZodString>;
    guestConsent: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "EARLY_CHECKIN" | "LATE_CHECKOUT";
    guestConsent: boolean;
    requestedTime?: string | undefined;
}, {
    type: "EARLY_CHECKIN" | "LATE_CHECKOUT";
    requestedTime?: string | undefined;
    guestConsent?: boolean | undefined;
}>;
export type CreateStayRequestInput = z.infer<typeof createStayRequestSchema>;
export declare const decideStayRequestSchema: z.ZodObject<{
    decision: z.ZodEnum<["APPROVED", "REJECTED"]>;
    decisionNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    decision: "REJECTED" | "APPROVED";
    decisionNote?: string | undefined;
}, {
    decision: "REJECTED" | "APPROVED";
    decisionNote?: string | undefined;
}>;
export type DecideStayRequestInput = z.infer<typeof decideStayRequestSchema>;
export declare const stayRequestIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type StayRequestIdParams = z.infer<typeof stayRequestIdParamsSchema>;
export declare const earlyCheckInActionSchema: z.ZodObject<{
    earlyCheckInFee: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    earlyCheckInFee?: number | undefined;
}, {
    earlyCheckInFee?: number | undefined;
}>;
export type EarlyCheckInActionInput = z.infer<typeof earlyCheckInActionSchema>;
export declare const lateCheckOutActionSchema: z.ZodObject<{
    lateCheckOutFee: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    lateCheckOutFee?: number | undefined;
}, {
    lateCheckOutFee?: number | undefined;
}>;
export type LateCheckOutActionInput = z.infer<typeof lateCheckOutActionSchema>;
export declare const modifyBookingSchema: z.ZodEffects<z.ZodObject<{
    checkIn: z.ZodOptional<z.ZodString>;
    checkOut: z.ZodOptional<z.ZodString>;
    roomIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    guestInfos: z.ZodOptional<z.ZodArray<z.ZodObject<{
        fullName: z.ZodString;
        email: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
        nationality: z.ZodOptional<z.ZodString>;
        idType: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"]>, z.ZodString]>>;
        idNumber: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }, {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }>, "many">>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    checkOut?: string | undefined;
    roomIds?: string[] | undefined;
    checkIn?: string | undefined;
    guestInfos?: {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }[] | undefined;
    reason?: string | undefined;
}, {
    checkOut?: string | undefined;
    roomIds?: string[] | undefined;
    checkIn?: string | undefined;
    guestInfos?: {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }[] | undefined;
    reason?: string | undefined;
}>, {
    checkOut?: string | undefined;
    roomIds?: string[] | undefined;
    checkIn?: string | undefined;
    guestInfos?: {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }[] | undefined;
    reason?: string | undefined;
}, {
    checkOut?: string | undefined;
    roomIds?: string[] | undefined;
    checkIn?: string | undefined;
    guestInfos?: {
        fullName: string;
        email: string;
        phone?: string | undefined;
        nationality?: string | undefined;
        idType?: string | undefined;
        idNumber?: string | undefined;
    }[] | undefined;
    reason?: string | undefined;
}>;
export type ModifyBookingInput = z.infer<typeof modifyBookingSchema>;
export declare const relocateRoomSchema: z.ZodObject<{
    oldRoomId: z.ZodString;
    newRoomId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    oldRoomId: string;
    newRoomId: string;
}, {
    reason: string;
    oldRoomId: string;
    newRoomId: string;
}>;
export type RelocateRoomInput = z.infer<typeof relocateRoomSchema>;
export declare const createWalkInBookingSchema: z.ZodEffects<z.ZodObject<{
    hotelId: z.ZodString;
    roomIds: z.ZodArray<z.ZodString, "many">;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    guests: z.ZodDefault<z.ZodObject<{
        adults: z.ZodDefault<z.ZodNumber>;
        children: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        adults: number;
        children: number;
    }, {
        adults?: number | undefined;
        children?: number | undefined;
    }>>;
    guestName: z.ZodString;
    guestEmail: z.ZodString;
    guestPhone: z.ZodString;
    guestIdNumber: z.ZodOptional<z.ZodString>;
    paymentMethod: z.ZodDefault<z.ZodEnum<["CREDIT_CARD", "PAYPAL", "TELEBIRR", "CBE_BIRR", "CASH", "CHAPA", "AWASH_BANK", "ENAT_BANK", "AMHARA_BANK", "COOP_BANK"]>>;
    paidImmediately: z.ZodDefault<z.ZodBoolean>;
    promoCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guests: {
        adults: number;
        children: number;
    };
    paymentMethod: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK";
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    paidImmediately: boolean;
    promoCode?: string | undefined;
    guestIdNumber?: string | undefined;
}, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guests?: {
        adults?: number | undefined;
        children?: number | undefined;
    } | undefined;
    promoCode?: string | undefined;
    paymentMethod?: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK" | undefined;
    guestIdNumber?: string | undefined;
    paidImmediately?: boolean | undefined;
}>, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guests: {
        adults: number;
        children: number;
    };
    paymentMethod: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK";
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    paidImmediately: boolean;
    promoCode?: string | undefined;
    guestIdNumber?: string | undefined;
}, {
    checkOut: string;
    hotelId: string;
    roomIds: string[];
    checkIn: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guests?: {
        adults?: number | undefined;
        children?: number | undefined;
    } | undefined;
    promoCode?: string | undefined;
    paymentMethod?: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK" | undefined;
    guestIdNumber?: string | undefined;
    paidImmediately?: boolean | undefined;
}>;
export type CreateWalkInBookingInput = z.infer<typeof createWalkInBookingSchema>;
export declare const verifyOtpSchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export declare const bankCallbackSchema: z.ZodObject<{
    status: z.ZodEnum<["AUTHORIZED", "DECLINED", "INSUFFICIENT_BALANCE", "TIMEOUT"]>;
    bankTransactionId: z.ZodOptional<z.ZodString>;
    pin: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "TIMEOUT" | "AUTHORIZED" | "DECLINED" | "INSUFFICIENT_BALANCE";
    bankTransactionId?: string | undefined;
    pin?: string | undefined;
}, {
    status: "TIMEOUT" | "AUTHORIZED" | "DECLINED" | "INSUFFICIENT_BALANCE";
    bankTransactionId?: string | undefined;
    pin?: string | undefined;
}>;
export type BankCallbackInput = z.infer<typeof bankCallbackSchema>;
export declare const chapaIntentSchema: z.ZodObject<{
    method: z.ZodEnum<["CREDIT_CARD", "PAYPAL", "TELEBIRR", "CBE_BIRR", "CASH", "CHAPA", "AWASH_BANK", "ENAT_BANK", "AMHARA_BANK", "COOP_BANK"]>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    bankCode: z.ZodOptional<z.ZodString>;
    accountNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    method: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK";
    email?: string | undefined;
    phone?: string | undefined;
    bankCode?: string | undefined;
    accountNumber?: string | undefined;
}, {
    method: "CREDIT_CARD" | "PAYPAL" | "TELEBIRR" | "CBE_BIRR" | "CASH" | "CHAPA" | "AWASH_BANK" | "ENAT_BANK" | "AMHARA_BANK" | "COOP_BANK";
    email?: string | undefined;
    phone?: string | undefined;
    bankCode?: string | undefined;
    accountNumber?: string | undefined;
}>;
export type ChapaIntentInput = z.infer<typeof chapaIntentSchema>;
export declare const chapaWebhookSchema: z.ZodObject<{
    tx_ref: z.ZodString;
    status: z.ZodEnum<["SUCCESS", "FAILED", "CANCELLED"]>;
    amount: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "CANCELLED" | "FAILED" | "SUCCESS";
    tx_ref: string;
    currency: string;
    amount?: number | undefined;
}, {
    status: "CANCELLED" | "FAILED" | "SUCCESS";
    tx_ref: string;
    amount?: number | undefined;
    currency?: string | undefined;
}>;
export type ChapaWebhookInput = z.infer<typeof chapaWebhookSchema>;
//# sourceMappingURL=booking.d.ts.map