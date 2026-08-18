import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ReviewService } from '../application/review.service';
import {
  ReviewDto,
  ReviewIdParamsDto,
  UpdateReviewDto,
} from './dto/review.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('reviews')
@ApiBearerAuth()
@Roles(Role.CUSTOMER)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Submit a review after a completed stay' })
  create(@Body() dto: ReviewDto, @Req() req: AuthedRequest) {
    return this.reviews.create(dto, req.user.sub);
  }

  @Get('my')
  @ApiOperation({ summary: 'List the current user reviews' })
  my(@Req() req: AuthedRequest) {
    return this.reviews.myReviews(req.user.sub);
  }

  @Patch(':reviewId')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Update one of your reviews' })
  update(
    @Param() params: ReviewIdParamsDto,
    @Body() dto: UpdateReviewDto,
    @Req() req: AuthedRequest,
  ) {
    return this.reviews.update(params.reviewId, dto, req.user.sub);
  }

  @Delete(':reviewId')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Delete one of your reviews' })
  remove(@Param() params: ReviewIdParamsDto, @Req() req: AuthedRequest) {
    return this.reviews.remove(params.reviewId, req.user.sub);
  }
}
