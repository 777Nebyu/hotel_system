import { Module } from '@nestjs/common';
import { ReviewController } from './presentation/review.controller';
import { HotelReviewsController } from './presentation/hotel-reviews.controller';
import { ManagerReviewController } from './presentation/manager-review.controller';
import { ReviewService } from './application/review.service';
import { ResourceScopeHelper } from '../../common/guards/resource-scope.helper';
import { AuditService } from '../../common/services/audit.service';

@Module({
  controllers: [
    ReviewController,
    HotelReviewsController,
    ManagerReviewController,
  ],
  providers: [ReviewService, ResourceScopeHelper, AuditService],
})
export class ReviewModule {}


