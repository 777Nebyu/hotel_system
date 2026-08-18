import { createZodDto } from 'nestjs-zod';
import {
  hotelIdParamsSchema,
  reviewIdParamsSchema,
  reviewSchema,
  reviewsQuerySchema,
  updateReviewSchema,
} from '@repo/shared-types';

export class ReviewDto extends createZodDto(reviewSchema) {}
export class UpdateReviewDto extends createZodDto(updateReviewSchema) {}
export class ReviewIdParamsDto extends createZodDto(reviewIdParamsSchema) {}
export class ReviewsQueryDto extends createZodDto(reviewsQuerySchema) {}
export class HotelIdParamsDto extends createZodDto(hotelIdParamsSchema) {}
