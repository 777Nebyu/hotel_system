import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ResourceScopeHelper {
  constructor(private db: PrismaService) {}

  async assertManagerOwnsHotel(
    userId: string,
    userRole: string,
    hotelId: string,
  ): Promise<void> {
    if (userRole === 'ADMIN') return; // Admin has platform-wide access
    if (userRole === 'MANAGER') {
      const hotel = await this.db.hotel.findFirst({
        where: { id: hotelId, managerId: userId },
      });
      if (!hotel) {
        throw new ForbiddenException(
          'Access denied: You do not manage this hotel',
        );
      }
      return;
    }
    throw new ForbiddenException(
      'Insufficient role permissions for hotel management',
    );
  }
}
