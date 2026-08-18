import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { ReviewService } from '../application/review.service';
import { HotelIdParamsDto, ReviewsQueryDto } from './dto/review.dto';

@ApiTags('reviews')
@Public()
@Controller('hotels')
export class HotelReviewsController {
  constructor(private readonly reviews: ReviewService) {}

  @Get(':id/reviews')
  @ApiOperation({ summary: 'List public reviews and summary for a hotel' })
  list(@Param() params: HotelIdParamsDto, @Query() query: ReviewsQueryDto) {
    return this.reviews.hotelReviews(params.id, query);
  }
}
