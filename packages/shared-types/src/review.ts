import { z } from 'zod';

const id = z.string().min(1);

export const reviewSchema = z.object({
  hotelId: id,
  bookingId: id.optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(2).max(2000),
  photos: z.array(z.string().url()).max(10).optional(),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const updateReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().min(2).max(2000).optional(),
  photos: z.array(z.string().url()).max(10).optional(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const reviewIdParamsSchema = z.object({ reviewId: id });
export type ReviewIdParams = z.infer<typeof reviewIdParamsSchema>;

export const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>;