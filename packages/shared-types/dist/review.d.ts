import { z } from 'zod';
export declare const reviewSchema: z.ZodObject<{
    hotelId: z.ZodString;
    bookingId: z.ZodOptional<z.ZodString>;
    rating: z.ZodNumber;
    comment: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    photos: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    hotelId: string;
    rating: number;
    comment: string;
    bookingId?: string | undefined;
    photos?: string[] | undefined;
}, {
    hotelId: string;
    rating: number;
    bookingId?: string | undefined;
    comment?: string | undefined;
    photos?: string[] | undefined;
}>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export declare const updateReviewSchema: z.ZodObject<{
    rating: z.ZodOptional<z.ZodNumber>;
    comment: z.ZodOptional<z.ZodString>;
    photos: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    rating?: number | undefined;
    comment?: string | undefined;
    photos?: string[] | undefined;
}, {
    rating?: number | undefined;
    comment?: string | undefined;
    photos?: string[] | undefined;
}>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export declare const reviewIdParamsSchema: z.ZodObject<{
    reviewId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reviewId: string;
}, {
    reviewId: string;
}>;
export type ReviewIdParams = z.infer<typeof reviewIdParamsSchema>;
export declare const reviewsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>;
export declare const respondReviewSchema: z.ZodObject<{
    response: z.ZodString;
}, "strip", z.ZodTypeAny, {
    response: string;
}, {
    response: string;
}>;
export type RespondReviewInput = z.infer<typeof respondReviewSchema>;
export declare const hotelReviewParamsSchema: z.ZodObject<{
    hotelId: z.ZodString;
    reviewId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    hotelId: string;
    reviewId: string;
}, {
    hotelId: string;
    reviewId: string;
}>;
export type HotelReviewParams = z.infer<typeof hotelReviewParamsSchema>;
//# sourceMappingURL=review.d.ts.map