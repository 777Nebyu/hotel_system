import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ReviewDeletedEvent,
  ReviewEditedEvent,
  ReviewEventNames,
  ReviewSubmittedEvent,
} from '../../events/review.events';
import { ResourceScopeHelper } from '../../../common/guards/resource-scope.helper';
import { AuditService } from '../../../common/services/audit.service';
import type {
  ReviewInput,
  ReviewsQuery,
  UpdateReviewInput,
} from '@repo/shared-types';

@Injectable()
export class ReviewService {
  constructor(
    private readonly db: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly scope: ResourceScopeHelper,
    private readonly audit: AuditService,
  ) {}

  async create(input: ReviewInput, userId: string) {
    const hotel = await this.db.hotel.findUnique({
      where: { id: input.hotelId },
      select: { id: true, status: true },
    });
    if (!hotel || hotel.status !== 'ACTIVE') {
      throw new NotFoundException('Hotel not found');
    }

    await this.assertCompletedStay(userId, input.hotelId, input.bookingId);

    const existing = await this.db.review.findFirst({
      where: { userId, hotelId: input.hotelId },
    });
    if (existing) {
      throw new ConflictException('You already reviewed this hotel');
    }

    const comment = this.cleanComment(input.comment);
    const review = await this.db.review.create({
      data: {
        userId,
        hotelId: input.hotelId,
        bookingId: input.bookingId,
        rating: input.rating,
        comment,
        photos: input.photos ?? undefined,
      },
      include: {
        user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
      },
    });

    this.emitter.emit(
      ReviewEventNames.SUBMITTED,
      new ReviewSubmittedEvent(review.id, userId, input.hotelId, input.rating),
    );

    return review;
  }

  async update(reviewId: string, input: UpdateReviewInput, actorId: string) {
    const review = await this.getOwned(reviewId, actorId);
    const ageMs = Date.now() - review.createdAt.getTime();
    if (ageMs > 48 * 60 * 60 * 1000) {
      throw new BadRequestException(
        'Reviews can only be edited within 48 hours of posting',
      );
    }
    const updated = await this.db.review.update({
      where: { id: review.id },
      data: {
        rating: input.rating,
        ...(input.comment === undefined
          ? {}
          : { comment: this.cleanComment(input.comment) }),
        photos: input.photos ?? undefined,
      },
      include: {
        user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
      },
    });

    this.emitter.emit(
      ReviewEventNames.EDITED,
      new ReviewEditedEvent(
        updated.id,
        actorId,
        review.hotelId,
        updated.rating,
      ),
    );

    return updated;
  }

  private cleanComment(comment: string): string {
    const cleaned = sanitizeHtml(comment, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
    if (cleaned.length < 2) {
      throw new BadRequestException('Review comment must contain readable text');
    }
    return cleaned;
  }

  async remove(reviewId: string, actorId: string) {
    const review = await this.getOwned(reviewId, actorId);
    await this.db.review.delete({ where: { id: review.id } });

    this.emitter.emit(
      ReviewEventNames.DELETED,
      new ReviewDeletedEvent(review.id, actorId, review.hotelId),
    );

    return { deleted: true };
  }

  async myReviews(userId: string) {
    return this.db.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        hotel: { select: { id: true, name: true, address: true } },
      },
    });
  }

  async hotelReviews(hotelId: string, query: ReviewsQuery) {
    const where = { hotelId };
    const [total, reviews] = await this.db.$transaction([
      this.db.review.count({ where }),
      this.db.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
          respondedBy: { select: { id: true, fullName: true, role: true } },
        },
      }),
    ]);
    const aggregate = await this.db.review.aggregate({
      where,
      _avg: { rating: true },
    });
    return {
      data: reviews,
      summary: {
        averageRating: aggregate._avg.rating ?? 0,
        reviewCount: total,
      },
      meta: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async hotelReviewsForManager(
    hotelId: string,
    query: ReviewsQuery,
    actor: { sub: string; role: string },
  ) {
    await this.scope.assertManagerOwnsHotel(actor.sub, actor.role, hotelId);
    const where = { hotelId };
    const [total, respondedCount, reviews] = await this.db.$transaction([
      this.db.review.count({ where }),
      this.db.review.count({ where: { hotelId, response: { not: null } } }),
      this.db.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profilePhotoUrl: true,
              email: true,
            },
          },
          respondedBy: { select: { id: true, fullName: true, role: true } },
          booking: {
            select: {
              id: true,
              bookingRef: true,
              checkIn: true,
              checkOut: true,
            },
          },
        },
      }),
    ]);
    const aggregate = await this.db.review.aggregate({
      where,
      _avg: { rating: true },
    });

    return {
      data: reviews,
      summary: {
        averageRating: aggregate._avg.rating ?? 0,
        reviewCount: total,
        respondedCount,
        pendingResponseCount: total - respondedCount,
      },
      meta: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async respondToReview(
    hotelId: string,
    reviewId: string,
    responseText: string,
    actor: { sub: string; role: string },
  ) {
    await this.scope.assertManagerOwnsHotel(actor.sub, actor.role, hotelId);
    const review = await this.db.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.hotelId !== hotelId) {
      throw new BadRequestException('Review does not belong to this hotel');
    }

    const cleaned = sanitizeHtml(responseText, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();

    if (cleaned.length < 2) {
      throw new BadRequestException('Response must be at least 2 characters');
    }

    const updated = await this.db.review.update({
      where: { id: reviewId },
      data: {
        response: cleaned,
        respondedAt: new Date(),
        respondedById: actor.sub,
      },
      include: {
        user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
        respondedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await this.audit.record(
      actor.sub,
      'REVIEW_RESPONSE_SUBMITTED',
      'Review',
      reviewId,
      {
        hotelId,
        reviewId,
        responseLength: cleaned.length,
      },
    );

    return updated;
  }

  async deleteReviewResponse(
    hotelId: string,
    reviewId: string,
    actor: { sub: string; role: string },
  ) {
    await this.scope.assertManagerOwnsHotel(actor.sub, actor.role, hotelId);
    const review = await this.db.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.hotelId !== hotelId) {
      throw new BadRequestException('Review does not belong to this hotel');
    }

    const updated = await this.db.review.update({
      where: { id: reviewId },
      data: {
        response: null,
        respondedAt: null,
        respondedById: null,
      },
      include: {
        user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
      },
    });

    await this.audit.record(
      actor.sub,
      'REVIEW_RESPONSE_DELETED',
      'Review',
      reviewId,
      { hotelId, reviewId },
    );

    return updated;
  }

  // ----- helpers -----

  private async getOwned(reviewId: string, actorId: string) {
    const review = await this.db.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== actorId) {
      throw new ForbiddenException('You cannot modify this review');
    }
    return review;
  }

  private async assertCompletedStay(
    userId: string,
    hotelId: string,
    bookingId?: string,
  ): Promise<void> {
    if (bookingId) {
      const booking = await this.db.booking.findFirst({
        where: { id: bookingId, userId, hotelId },
        select: { status: true },
      });
      if (!booking) {
        throw new BadRequestException(
          'bookingId does not belong to this user and hotel',
        );
      }
      if (booking.status !== 'CHECKED_OUT') {
        throw new BadRequestException(
          'Reviews are allowed only after a completed stay',
        );
      }
      const already = await this.db.review.findUnique({
        where: { bookingId: bookingId },
        select: { id: true },
      });
      if (already) {
        throw new ConflictException('This booking was already reviewed');
      }
      return;
    }

    const completed = await this.db.booking.findFirst({
      where: { userId, hotelId, status: 'CHECKED_OUT' },
      select: { id: true },
    });
    if (!completed) {
      throw new BadRequestException(
        'Reviews are allowed only after a completed stay at this hotel',
      );
    }
  }
}
