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
});
