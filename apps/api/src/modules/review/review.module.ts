import { Module } from '@nestjs/common';
import { ReviewController } from './presentation/review.controller';
import { HotelReviewsController } from './presentation/hotel-reviews.controller';
import { ReviewService } from './application/review.service';

@Module({
  controllers: [ReviewController, HotelReviewsController],
  providers: [ReviewService],
})
export class ReviewModule {}
