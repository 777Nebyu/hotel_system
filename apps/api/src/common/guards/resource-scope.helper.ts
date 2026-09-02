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
    if (userRole === 'ADMIN') return;
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
    if (userRole === 'STAFF') {
      await this.assertStaffAssignedToHotel(userId, hotelId);
      return;
    }
    throw new ForbiddenException(
      'Insufficient role permissions for hotel management',
    );
  }

  async assertStaffAssignedToHotel(
    userId: string,
    hotelId: string,
  ): Promise<void> {
    const assignment = await this.db.staffHotel.findUnique({
      where: { staffId_hotelId: { staffId: userId, hotelId } },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'Access denied: You are not assigned to this hotel',
      );
    }
  }

  async getStaffHotelIds(userId: string): Promise<string[]> {
    const assignments = await this.db.staffHotel.findMany({
      where: { staffId: userId },
      select: { hotelId: true },
    });
    return assignments.map((a) => a.hotelId);
  }
}
