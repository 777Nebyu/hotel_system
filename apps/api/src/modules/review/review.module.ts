import { Module } from '@nestjs/common';
import { ReviewController } from './presentation/review.controller';
import { ReviewService } from './application/review.service';

@Module({ controllers: [ReviewController], providers: [ReviewService] })
export class ReviewModule {}
