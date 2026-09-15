import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ReviewService } from '../application/review.service';
import {
  HotelReviewParamsDto,
  RespondReviewDto,
  ReviewsQueryDto,
} from './dto/review.dto';

const managerHotelParamsSchema = z.object({
  hotelId: z.string().min(1),
});
class ManagerHotelParamsDto extends createZodDto(managerHotelParamsSchema) {}

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('reviews (manager)')
@ApiBearerAuth()
@Roles(Role.MANAGER, Role.ADMIN)
@Controller('manager/hotels/:hotelId/reviews')
export class ManagerReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get()
  @ApiOperation({
    summary: 'List reviews for a managed hotel with response metrics',
  })
  list(
    @Param() params: ManagerHotelParamsDto,
    @Query() query: ReviewsQueryDto,
    @Req() req: AuthedRequest,
  ) {
    return this.reviews.hotelReviewsForManager(params.hotelId, query, req.user);
  }

  @Post(':reviewId/response')
  @ApiOperation({
    summary: 'Submit or update a public manager response to a review',
  })
  respond(
    @Param() params: HotelReviewParamsDto,
    @Body() dto: RespondReviewDto,
    @Req() req: AuthedRequest,
  ) {
    return this.reviews.respondToReview(
      params.hotelId,
      params.reviewId,
      dto.response,
      req.user,
    );
  }

  @Delete(':reviewId/response')
  @ApiOperation({ summary: 'Remove a manager response from a review' })
  deleteResponse(
    @Param() params: HotelReviewParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.reviews.deleteReviewResponse(
      params.hotelId,
      params.reviewId,
      req.user,
    );
  }
}
