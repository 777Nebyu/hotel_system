import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import type { AdminReviewsQuery } from '@repo/shared-types';

@Injectable()
export class AdminReviewService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminReviewsQuery) {
    const where: Prisma.ReviewWhereInput = {};
    if (query.hotelId) where.hotelId = query.hotelId;
    if (query.minRating) where.rating = { gte: query.minRating };
    const [total, reviews] = await Promise.all([
      this.db.review.count({ where }),
      this.db.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          hotel: { select: { id: true, name: true } },
        },
      }),
    ]);
    return { data: reviews, total, page: query.page, pageSize: query.pageSize };
  }

  async remove(reviewId: string, actorId: string) {
    const review = await this.db.review.findUniqueOrThrow({
      where: { id: reviewId },
    });
    await this.db.review.delete({ where: { id: reviewId } });
    await this.audit.record(actorId, 'DELETE', 'Review', reviewId, {
      rating: review.rating,
    });
    return { ok: true };
  }
}
