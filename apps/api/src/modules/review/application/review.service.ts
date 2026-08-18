import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ReviewEventNames,
  ReviewSubmittedEvent,
} from '../../events/review.events';
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

    const review = await this.db.review.create({
      data: {
        userId,
        hotelId: input.hotelId,
        bookingId: input.bookingId,
        rating: input.rating,
        comment: input.comment,
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
    return this.db.review.update({
      where: { id: review.id },
      data: {
        rating: input.rating,
        comment: input.comment,
        photos: input.photos ?? undefined,
      },
      include: {
        user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
      },
    });
  }

  async remove(reviewId: string, actorId: string) {
    const review = await this.getOwned(reviewId, actorId);
    await this.db.review.delete({ where: { id: review.id } });
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
        averageRating: aggregate._avg.rating,
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
