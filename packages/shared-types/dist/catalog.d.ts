import { z } from 'zod';
export declare const roomTypeSchema: z.ZodEnum<["STANDARD", "DELUXE", "SUITE", "FAMILY", "EXECUTIVE"]>;
export type RoomType = z.infer<typeof roomTypeSchema>;
export declare const roomStatusSchema: z.ZodEnum<["AVAILABLE", "UNAVAILABLE", "MAINTENANCE", "CLEANING"]>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export declare const updateRoomStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["AVAILABLE", "UNAVAILABLE", "MAINTENANCE", "CLEANING"]>;
}, "strip", z.ZodTypeAny, {
    status: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE" | "CLEANING";
}, {
    status: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE" | "CLEANING";
}>;
export type UpdateRoomStatusInput = z.infer<typeof updateRoomStatusSchema>;
export declare const hotelStatusSchema: z.ZodEnum<["PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "REJECTED"]>;
export type HotelStatus = z.infer<typeof hotelStatusSchema>;
export declare const hotelIdParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type HotelIdParams = z.infer<typeof hotelIdParamsSchema>;
export declare const roomIdParamsSchema: z.ZodObject<{
    roomId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
}, {
    roomId: string;
}>;
export type RoomIdParams = z.infer<typeof roomIdParamsSchema>;
export declare const amenityIdParamsSchema: z.ZodObject<{
    amenityId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amenityId: string;
}, {
    amenityId: string;
}>;
export type AmenityIdParams = z.infer<typeof amenityIdParamsSchema>;
export declare const imageIdParamsSchema: z.ZodObject<{
    imageId: z.ZodString;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    imageId: string;
}, {
    id: string;
    imageId: string;
}>;
export type ImageIdParams = z.infer<typeof imageIdParamsSchema>;
export declare const seasonalPricingParamsSchema: z.ZodObject<{
    roomId: z.ZodString;
    pricingId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    pricingId: string;
}, {
    roomId: string;
    pricingId: string;
}>;
export type SeasonalPricingParams = z.infer<typeof seasonalPricingParamsSchema>;
export declare const hotelAmenityParamsSchema: z.ZodObject<{
    id: z.ZodString;
    amenityId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    amenityId: string;
}, {
    id: string;
    amenityId: string;
}>;
export type HotelAmenityParams = z.infer<typeof hotelAmenityParamsSchema>;
export declare const roomAmenityParamsSchema: z.ZodObject<{
    roomId: z.ZodString;
    amenityId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    amenityId: string;
}, {
    roomId: string;
    amenityId: string;
}>;
export type RoomAmenityParams = z.infer<typeof roomAmenityParamsSchema>;
export declare const roomImageParamsSchema: z.ZodObject<{
    roomId: z.ZodString;
    imageId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roomId: string;
    imageId: string;
}, {
    roomId: string;
    imageId: string;
}>;
export type RoomImageParams = z.infer<typeof roomImageParamsSchema>;
export declare const createHotelSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    cityId: z.ZodString;
    address: z.ZodString;
    lat: z.ZodOptional<z.ZodNumber>;
    lng: z.ZodOptional<z.ZodNumber>;
    starRating: z.ZodDefault<z.ZodNumber>;
    status: z.ZodDefault<z.ZodEnum<["PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "REJECTED"]>>;
    managerId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "REJECTED" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED";
    name: string;
    description: string;
    cityId: string;
    address: string;
    starRating: number;
    managerId?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
}, {
    name: string;
    description: string;
    cityId: string;
    address: string;
    status?: "REJECTED" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | undefined;
    managerId?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    starRating?: number | undefined;
}>;
export type CreateHotelInput = z.infer<typeof createHotelSchema>;
export declare const updateHotelSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    cityId: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    lat: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    lng: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    starRating: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "REJECTED"]>>>;
    managerId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
} & {
    rejectionReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "REJECTED" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | undefined;
    rejectionReason?: string | null | undefined;
    managerId?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    cityId?: string | undefined;
    address?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    starRating?: number | undefined;
}, {
    status?: "REJECTED" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | undefined;
    rejectionReason?: string | null | undefined;
    managerId?: string | undefined;
    name?: string | undefined;
    description?: string | undefined;
    cityId?: string | undefined;
    address?: string | undefined;
    lat?: number | undefined;
    lng?: number | undefined;
    starRating?: number | undefined;
}>;
export type UpdateHotelInput = z.infer<typeof updateHotelSchema>;
export declare const createRoomSchema: z.ZodObject<{
    roomNumber: z.ZodString;
    type: z.ZodEnum<["STANDARD", "DELUXE", "SUITE", "FAMILY", "EXECUTIVE"]>;
    capacity: z.ZodEffects<z.ZodNumber, number, unknown>;
    beds: z.ZodDefault<z.ZodEffects<z.ZodNumber, number, unknown>>;
    bathroom: z.ZodDefault<z.ZodEffects<z.ZodNumber, number, unknown>>;
    basePrice: z.ZodEffects<z.ZodNumber, number, unknown>;
    status: z.ZodDefault<z.ZodEnum<["AVAILABLE", "UNAVAILABLE", "MAINTENANCE", "CLEANING"]>>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "STANDARD" | "DELUXE" | "SUITE" | "FAMILY" | "EXECUTIVE";
    status: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE" | "CLEANING";
    roomNumber: string;
    capacity: number;
    beds: number;
    bathroom: number;
    basePrice: number;
    description?: string | undefined;
}, {
    type: "STANDARD" | "DELUXE" | "SUITE" | "FAMILY" | "EXECUTIVE";
    roomNumber: string;
    status?: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE" | "CLEANING" | undefined;
    description?: string | undefined;
    capacity?: unknown;
    beds?: unknown;
    bathroom?: unknown;
    basePrice?: unknown;
}>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export declare const updateRoomSchema: z.ZodObject<{
    roomNumber: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["STANDARD", "DELUXE", "SUITE", "FAMILY", "EXECUTIVE"]>>;
    capacity: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, unknown>>;
    beds: z.ZodOptional<z.ZodDefault<z.ZodEffects<z.ZodNumber, number, unknown>>>;
    bathroom: z.ZodOptional<z.ZodDefault<z.ZodEffects<z.ZodNumber, number, unknown>>>;
    basePrice: z.ZodOptional<z.ZodEffects<z.ZodNumber, number, unknown>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["AVAILABLE", "UNAVAILABLE", "MAINTENANCE", "CLEANING"]>>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type?: "STANDARD" | "DELUXE" | "SUITE" | "FAMILY" | "EXECUTIVE" | undefined;
    status?: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE" | "CLEANING" | undefined;
    description?: string | undefined;
    roomNumber?: string | undefined;
    capacity?: number | undefined;
    beds?: number | undefined;
    bathroom?: number | undefined;
    basePrice?: number | undefined;
}, {
    type?: "STANDARD" | "DELUXE" | "SUITE" | "FAMILY" | "EXECUTIVE" | undefined;
    status?: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE" | "CLEANING" | undefined;
    description?: string | undefined;
    roomNumber?: string | undefined;
    capacity?: unknown;
    beds?: unknown;
    bathroom?: unknown;
    basePrice?: unknown;
}>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export declare const seasonalPricingSchema: z.ZodEffects<z.ZodObject<{
    startDate: z.ZodDate;
    endDate: z.ZodDate;
    priceOverride: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    startDate: Date;
    endDate: Date;
    priceOverride: number;
}, {
    startDate: Date;
    endDate: Date;
    priceOverride: number;
}>, {
    startDate: Date;
    endDate: Date;
    priceOverride: number;
}, {
    startDate: Date;
    endDate: Date;
    priceOverride: number;
}>;
export type SeasonalPricingInput = z.infer<typeof seasonalPricingSchema>;
export declare const availabilityBulkSchema: z.ZodObject<{
    dates: z.ZodArray<z.ZodDate, "many">;
    status: z.ZodEnum<["AVAILABLE", "UNAVAILABLE", "MAINTENANCE", "CLEANING"]>;
}, "strip", z.ZodTypeAny, {
    status: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE" | "CLEANING";
    dates: Date[];
}, {
    status: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE" | "CLEANING";
    dates: Date[];
}>;
export type AvailabilityBulkInput = z.infer<typeof availabilityBulkSchema>;
export declare const blockMaintenanceSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    roomId: z.ZodOptional<z.ZodString>;
    roomIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    startDate: z.ZodDate;
    endDate: z.ZodDate;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    startDate: Date;
    endDate: Date;
    roomIds?: string[] | undefined;
    roomId?: string | undefined;
    reason?: string | undefined;
}, {
    startDate: Date;
    endDate: Date;
    roomIds?: string[] | undefined;
    roomId?: string | undefined;
    reason?: string | undefined;
}>, {
    startDate: Date;
    endDate: Date;
    roomIds?: string[] | undefined;
    roomId?: string | undefined;
    reason?: string | undefined;
}, {
    startDate: Date;
    endDate: Date;
    roomIds?: string[] | undefined;
    roomId?: string | undefined;
    reason?: string | undefined;
}>, {
    startDate: Date;
    endDate: Date;
    roomIds?: string[] | undefined;
    roomId?: string | undefined;
    reason?: string | undefined;
}, {
    startDate: Date;
    endDate: Date;
    roomIds?: string[] | undefined;
    roomId?: string | undefined;
    reason?: string | undefined;
}>;
export type BlockMaintenanceInput = z.infer<typeof blockMaintenanceSchema>;
export declare const upsertHotelPolicySchema: z.ZodObject<{
    checkInTime: z.ZodDefault<z.ZodString>;
    checkOutTime: z.ZodDefault<z.ZodString>;
    cancellationWindowDays: z.ZodDefault<z.ZodNumber>;
    cancellationFeePercent: z.ZodDefault<z.ZodNumber>;
    allowEarlyCheckIn: z.ZodDefault<z.ZodBoolean>;
    earlyCheckInFee: z.ZodDefault<z.ZodNumber>;
    allowLateCheckOut: z.ZodDefault<z.ZodBoolean>;
    lateCheckOutFee: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    earlyCheckInFee: number;
    lateCheckOutFee: number;
    checkInTime: string;
    checkOutTime: string;
    cancellationWindowDays: number;
    cancellationFeePercent: number;
    allowEarlyCheckIn: boolean;
    allowLateCheckOut: boolean;
}, {
    earlyCheckInFee?: number | undefined;
    lateCheckOutFee?: number | undefined;
    checkInTime?: string | undefined;
    checkOutTime?: string | undefined;
    cancellationWindowDays?: number | undefined;
    cancellationFeePercent?: number | undefined;
    allowEarlyCheckIn?: boolean | undefined;
    allowLateCheckOut?: boolean | undefined;
}>;
export type UpsertHotelPolicyInput = z.infer<typeof upsertHotelPolicySchema>;
export declare const attachAmenitySchema: z.ZodObject<{
    amenityId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amenityId: string;
}, {
    amenityId: string;
}>;
export type AttachAmenityInput = z.infer<typeof attachAmenitySchema>;
export declare const hotelSortSchema: z.ZodEnum<["price_asc", "price_desc", "rating_desc", "popularity"]>;
export type HotelSort = z.infer<typeof hotelSortSchema>;
export declare const searchHotelsSchema: z.ZodObject<{
    city: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    priceMin: z.ZodOptional<z.ZodNumber>;
    priceMax: z.ZodOptional<z.ZodNumber>;
    minRating: z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
    roomType: z.ZodOptional<z.ZodEnum<["STANDARD", "DELUXE", "SUITE", "FAMILY", "EXECUTIVE"]>>;
    amenities: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>, string[] | undefined, string | string[] | undefined>;
    sort: z.ZodDefault<z.ZodEnum<["price_asc", "price_desc", "rating_desc", "popularity"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sort: "price_asc" | "price_desc" | "rating_desc" | "popularity";
    page: number;
    pageSize: number;
    minRating?: number | undefined;
    city?: string | undefined;
    country?: string | undefined;
    priceMin?: number | undefined;
    priceMax?: number | undefined;
    roomType?: "STANDARD" | "DELUXE" | "SUITE" | "FAMILY" | "EXECUTIVE" | undefined;
    amenities?: string[] | undefined;
}, {
    sort?: "price_asc" | "price_desc" | "rating_desc" | "popularity" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    minRating?: unknown;
    city?: string | undefined;
    country?: string | undefined;
    priceMin?: number | undefined;
    priceMax?: number | undefined;
    roomType?: "STANDARD" | "DELUXE" | "SUITE" | "FAMILY" | "EXECUTIVE" | undefined;
    amenities?: string | string[] | undefined;
}>;
export type SearchHotelsQuery = z.infer<typeof searchHotelsSchema>;
export declare const availabilityWindowSchema: z.ZodEffects<z.ZodObject<{
    checkIn: z.ZodString;
    checkOut: z.ZodString;
}, "strip", z.ZodTypeAny, {
    checkOut: string;
    checkIn: string;
}, {
    checkOut: string;
    checkIn: string;
}>, {
    checkOut: string;
    checkIn: string;
}, {
    checkOut: string;
    checkIn: string;
}>;
export type AvailabilityWindow = z.infer<typeof availabilityWindowSchema>;
export interface Paginated<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
    };
}
//# sourceMappingURL=catalog.d.ts.map