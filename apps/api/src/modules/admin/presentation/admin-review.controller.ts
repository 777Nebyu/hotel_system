import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../../../generated/prisma/client';
import { reviewIdParamsSchema } from '@repo/shared-types';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminReviewService } from '../application/admin-review.service';
import { AdminReviewsQueryDto } from './dto/admin.dto';

class ReviewIdParamsDto extends createZodDto(reviewIdParamsSchema) {}
class ReviewReasonDto extends createZodDto(
  z.object({ reason: z.string().trim().min(1).max(500) }),
) {}

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/reviews')
export class AdminReviewController {
  constructor(private readonly reviews: AdminReviewService) {}

  @Get()
  @ApiOperation({ summary: 'List all reviews for moderation' })
  list(@Query() query: AdminReviewsQueryDto) {
    return this.reviews.list(query);
  }

  @Post(':reviewId/flag')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Flag a review for moderation' })
  flag(
    @Param() params: ReviewIdParamsDto,
    @Body() dto: ReviewReasonDto,
    @Req() req: AuthedRequest,
  ) {
    return this.reviews.flag(params.reviewId, dto.reason, req.user.sub);
  }

  @Post(':reviewId/unflag')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Unflag a previously flagged review' })
  unflag(@Param() params: ReviewIdParamsDto, @Req() req: AuthedRequest) {
    return this.reviews.unflag(params.reviewId, req.user.sub);
  }

  @Delete(':reviewId')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Remove a review from the platform' })
  remove(
    @Param() params: ReviewIdParamsDto,
    @Body() dto: ReviewReasonDto,
    @Req() req: AuthedRequest,
  ) {
    return this.reviews.remove(params.reviewId, req.user.sub, dto.reason);
  }
}
