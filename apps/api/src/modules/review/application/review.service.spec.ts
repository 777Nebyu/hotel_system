import type { PrismaService } from '../../../prisma/prisma.service';
import { ReviewService } from './review.service';

describe('ReviewService sanitization', () => {
  it('stores review comments without HTML tags', async () => {
    const db = {
      hotel: { findUnique: jest.fn().mockResolvedValue({ id: 'hotel-1', status: 'ACTIVE' }) },
      booking: { findFirst: jest.fn().mockResolvedValue({ status: 'CHECKED_OUT' }) },
      review: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'review-1' }),
      },
    };
    const emitter = { emit: jest.fn() };
    const service = new ReviewService(db as never, emitter as never);

    await service.create(
      {
        hotelId: 'hotel-1',
        rating: 5,
        comment: '<script>alert(1)</script><b>Great stay</b>',
      },
      'user-1',
    );

    expect(db.review.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ comment: 'Great stay' }) }),
    );
  });

  describe('48-hour edit window lock', () => {
    it('allows editing if review is less than 48 hours old', async () => {
      const db = {
        review: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'review-1',
            userId: 'user-1',
            hotelId: 'hotel-1',
            createdAt: new Date(Date.now() - 24 * 3600 * 1000), // 24 hours ago
          }),
          update: jest.fn().mockResolvedValue({
            id: 'review-1',
            rating: 4,
            comment: 'Updated review text',
          }),
        },
      };
      const emitter = { emit: jest.fn() };
      const service = new ReviewService(db as never, emitter as never);

      const result = await service.update(
        'review-1',
        { rating: 4, comment: 'Updated review text' },
        'user-1',
      );

      expect(result.rating).toBe(4);
      expect(emitter.emit).toHaveBeenCalledWith(
        'review.edited',
        expect.objectContaining({
          reviewId: 'review-1',
          userId: 'user-1',
          rating: 4,
        }),
      );
    });

    it('throws BadRequestException if review is more than 48 hours old', async () => {
      const db = {
        review: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'review-1',
            userId: 'user-1',
            hotelId: 'hotel-1',
            createdAt: new Date(Date.now() - 50 * 3600 * 1000), // 50 hours ago
          }),
        },
      };
      const emitter = { emit: jest.fn() };
      const service = new ReviewService(db as never, emitter as never);

      await expect(
        service.update(
          'review-1',
          { rating: 4, comment: 'Updated review text' },
          'user-1',
        ),
      ).rejects.toThrow('Reviews can only be edited within 48 hours of posting');
    });
  });
});
