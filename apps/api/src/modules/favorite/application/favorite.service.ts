import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { roundCurrency } from '../../catalog/domain/pricing';

@Injectable()
export class FavoriteService {
  constructor(private readonly db: PrismaService) {}

  async toggleOn(hotelId: string, userId: string) {
    const hotel = await this.db.hotel.findUnique({
      where: { id: hotelId },
      select: { id: true, status: true },
    });
    if (!hotel || hotel.status !== 'ACTIVE') {
      throw new NotFoundException('Hotel not found');
    }
    await this.db.favorite.upsert({
      where: { userId_hotelId: { userId, hotelId } },
      create: { userId, hotelId },
      update: {},
    });
    return { favorited: true };
  }

  async toggleOff(hotelId: string, userId: string) {
    await this.db.favorite.deleteMany({
      where: { userId, hotelId },
    });
    return { favorited: false };
  }

  async myFavorites(userId: string) {
    const favorites = await this.db.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        hotel: {
          include: {
            images: true,
            city: { include: { country: true } },
            reviews: { select: { rating: true } },
            rooms: { select: { basePrice: true } },
          },
        },
      },
    });
    return favorites.map(({ hotel }) => {
      const minPrice = Math.min(
        0,
        ...hotel.rooms.map((room) => room.basePrice.toNumber()),
      );
      const ratingSum = hotel.reviews.reduce((sum, r) => sum + r.rating, 0);
      return {
        id: hotel.id,
        name: hotel.name,
        address: hotel.address,
        starRating: hotel.starRating,
        city: {
          id: hotel.city.id,
          name: hotel.city.name,
          country: { name: hotel.city.country.name },
        },
        primaryImageUrl:
          hotel.images.find((image) => image.isPrimary)?.url ??
          hotel.images[0]?.url ??
          null,
        minPricePerNight: minPrice > 0 ? roundCurrency(minPrice) : null,
        averageRating: hotel.reviews.length
          ? ratingSum / hotel.reviews.length
          : null,
        reviewCount: hotel.reviews.length,
      };
    });
  }
}
