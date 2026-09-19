"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hotelReviewParamsSchema = exports.respondReviewSchema = exports.reviewsQuerySchema = exports.reviewIdParamsSchema = exports.updateReviewSchema = exports.reviewSchema = void 0;
const zod_1 = require("zod");
const id = zod_1.z.string().min(1);
exports.reviewSchema = zod_1.z.object({
    hotelId: id,
    bookingId: id.optional(),
    rating: zod_1.z.coerce.number().int().min(1).max(5),
    comment: zod_1.z.string().max(2000).optional().default(''),
    photos: zod_1.z.array(zod_1.z.string().url()).max(10).optional(),
});
exports.updateReviewSchema = zod_1.z.object({
    rating: zod_1.z.coerce.number().int().min(1).max(5).optional(),
    comment: zod_1.z.string().min(2).max(2000).optional(),
    photos: zod_1.z.array(zod_1.z.string().url()).max(10).optional(),
});
exports.reviewIdParamsSchema = zod_1.z.object({ reviewId: id });
exports.reviewsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.respondReviewSchema = zod_1.z.object({
    response: zod_1.z.string().min(2).max(2000),
});
exports.hotelReviewParamsSchema = zod_1.z.object({
    hotelId: id,
    reviewId: id,
});
