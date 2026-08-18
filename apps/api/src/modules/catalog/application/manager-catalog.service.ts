import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceScopeHelper } from '../../../common/guards/resource-scope.helper';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../infrastructure/storage/storage';
import type {
  AvailabilityBulkInput,
  CreateHotelInput,
  CreateRoomInput,
  SeasonalPricingInput,
  UpdateHotelInput,
  UpdateRoomInput,
} from '@repo/shared-types';

export interface CatalogActor {
  sub: string;
  role: string;
}

@Injectable()
export class ManagerCatalogService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: ResourceScopeHelper,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
  ) {}

  // ----- hotels -----

  async myHotels(userId: string) {
    return this.db.hotel.findMany({
      where: { managerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        city: { include: { country: true } },
        images: true,
        _count: { select: { bookings: true, rooms: true } },
      },
    });
  }

  async createHotel(dto: CreateHotelInput, actor: CatalogActor) {
    await this.assertCityExists(dto.cityId);
    const managerId =
      actor.role === 'ADMIN' ? (dto.managerId ?? null) : actor.sub;
    return this.db.hotel.create({
      data: {
        name: dto.name,
        description: dto.description,
        cityId: dto.cityId,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        starRating: dto.starRating ?? 3,
        status: dto.status ?? 'ACTIVE',
        managerId,
      },
      include: {
        city: { include: { country: true } },
        images: true,
      },
    });
  }

  async updateHotel(id: string, dto: UpdateHotelInput, actor: CatalogActor) {
    await this.assertCanManage(id, actor);
    if (dto.cityId) await this.assertCityExists(dto.cityId);
    const data: Prisma.HotelUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;
    if (dto.starRating !== undefined) data.starRating = dto.starRating;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.managerId !== undefined && actor.role === 'ADMIN') {
      data.manager = { connect: { id: dto.managerId } };
    }
    return this.db.hotel.update({
      where: { id },
      data,
      include: {
        city: { include: { country: true } },
        images: true,
      },
    });
  }

  async deleteHotel(id: string, actor: CatalogActor) {
    await this.assertCanManage(id, actor);
    const bookings = await this.db.hotel
      .findUnique({ where: { id } })
      .bookings({ select: { id: true } });
    if ((bookings?.length ?? 0) > 0) {
      throw new ConflictException('Hotel has bookings and cannot be deleted');
    }
    await this.db.hotel.delete({ where: { id } });
    return { deleted: true };
  }

  // ----- hotel images -----

  async addHotelImages(
    id: string,
    files: Express.Multer.File[],
    actor: CatalogActor,
  ) {
    await this.assertCanManage(id, actor);
    const created: { id: string; url: string; isPrimary: boolean }[] = [];
    for (const file of files) {
      const stored = await this.storage.upload(file, 'hotels');
      const image = await this.db.hotelImage.create({
        data: { hotelId: id, url: stored.url },
      });
      created.push({
        id: image.id,
        url: image.url,
        isPrimary: image.isPrimary,
      });
    }
    return created;
  }

  async setPrimaryHotelImage(id: string, imageId: string, actor: CatalogActor) {
    await this.assertCanManage(id, actor);
    const image = await this.db.hotelImage.findFirst({
      where: { id: imageId, hotelId: id },
    });
    if (!image) throw new NotFoundException('Image not found');
    await this.db.$transaction([
      this.db.hotelImage.updateMany({
        where: { hotelId: id },
        data: { isPrimary: false },
      }),
      this.db.hotelImage.update({
        where: { id: image.id },
        data: { isPrimary: true },
      }),
    ]);
    return { primaryImageId: image.id };
  }

  async removeHotelImage(id: string, imageId: string, actor: CatalogActor) {
    await this.assertCanManage(id, actor);
    const image = await this.db.hotelImage.findFirst({
      where: { id: imageId, hotelId: id },
    });
    if (!image) throw new NotFoundException('Image not found');
    await this.storage.remove({ url: image.url, publicId: null });
    await this.db.hotelImage.delete({ where: { id: image.id } });
    return { deleted: true };
  }

  // ----- hotel amenities -----

  async attachHotelAmenity(id: string, amenityId: string, actor: CatalogActor) {
    await this.assertCanManage(id, actor);
    await this.assertAmenityExists(amenityId);
    return this.db.hotelAmenity.upsert({
      where: { hotelId_amenityId: { hotelId: id, amenityId } },
      create: { hotelId: id, amenityId },
      update: {},
      include: { amenity: true },
    });
  }

  async detachHotelAmenity(id: string, amenityId: string, actor: CatalogActor) {
    await this.assertCanManage(id, actor);
    await this.db.hotelAmenity.delete({
      where: { hotelId_amenityId: { hotelId: id, amenityId } },
    });
    return { deleted: true };
  }

  // ----- rooms -----

  async createRoom(hotelId: string, dto: CreateRoomInput, actor: CatalogActor) {
    await this.assertCanManage(hotelId, actor);
    try {
      return await this.db.room.create({
        data: {
          hotelId,
          roomNumber: dto.roomNumber,
          type: dto.type,
          capacity: dto.capacity,
          beds: dto.beds ?? 1,
          bathroom: dto.bathroom ?? 1,
          basePrice: dto.basePrice,
          status: dto.status ?? 'AVAILABLE',
          description: dto.description,
        },
        include: { images: true },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          `A room with number "${dto.roomNumber}" already exists`,
        );
      }
      throw error;
    }
  }

  async updateRoom(roomId: string, dto: UpdateRoomInput, actor: CatalogActor) {
    const room = await this.getManagedRoom(roomId, actor);
    return this.db.room.update({
      where: { id: room.id },
      data: dto,
      include: { images: true },
    });
  }

  async deleteRoom(roomId: string, actor: CatalogActor) {
    const room = await this.getManagedRoom(roomId, actor);
    const details = await this.db.bookingDetail.count({
      where: { roomId: room.id },
    });
    if (details > 0) {
      throw new ConflictException(
        'Room is referenced by bookings and cannot be deleted',
      );
    }
    await this.db.room.delete({ where: { id: room.id } });
    return { deleted: true };
  }

  // ----- room images -----

  async addRoomImages(
    roomId: string,
    files: Express.Multer.File[],
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    const created: { id: string; url: string; isPrimary: boolean }[] = [];
    for (const file of files) {
      const stored = await this.storage.upload(file, 'rooms');
      const image = await this.db.roomImage.create({
        data: { roomId, url: stored.url },
      });
      created.push({
        id: image.id,
        url: image.url,
        isPrimary: image.isPrimary,
      });
    }
    return created;
  }

  async setPrimaryRoomImage(
    roomId: string,
    imageId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    const image = await this.db.roomImage.findFirst({
      where: { id: imageId, roomId },
    });
    if (!image) throw new NotFoundException('Image not found');
    await this.db.$transaction([
      this.db.roomImage.updateMany({
        where: { roomId },
        data: { isPrimary: false },
      }),
      this.db.roomImage.update({
        where: { id: image.id },
        data: { isPrimary: true },
      }),
    ]);
    return { primaryImageId: image.id };
  }

  async removeRoomImage(roomId: string, imageId: string, actor: CatalogActor) {
    await this.assertCanManageRoom(roomId, actor);
    const image = await this.db.roomImage.findFirst({
      where: { id: imageId, roomId },
    });
    if (!image) throw new NotFoundException('Image not found');
    await this.storage.remove({ url: image.url, publicId: null });
    await this.db.roomImage.delete({ where: { id: image.id } });
    return { deleted: true };
  }

  // ----- room amenities -----

  async attachRoomAmenity(
    roomId: string,
    amenityId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    await this.assertAmenityExists(amenityId);
    return this.db.roomAmenity.upsert({
      where: { roomId_amenityId: { roomId, amenityId } },
      create: { roomId, amenityId },
      update: {},
      include: { amenity: true },
    });
  }

  async detachRoomAmenity(
    roomId: string,
    amenityId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    await this.db.roomAmenity.delete({
      where: { roomId_amenityId: { roomId, amenityId } },
    });
    return { deleted: true };
  }

  // ----- seasonal pricing -----

  async upsertSeasonalPricing(
    roomId: string,
    dto: SeasonalPricingInput,
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    return this.db.seasonalPricing.create({
      data: {
        roomId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        priceOverride: dto.priceOverride,
      },
    });
  }

  async removeSeasonalPricing(
    roomId: string,
    pricingId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    const pricing = await this.db.seasonalPricing.findFirst({
      where: { id: pricingId, roomId },
    });
    if (!pricing) throw new NotFoundException('Seasonal pricing not found');
    await this.db.seasonalPricing.delete({ where: { id: pricing.id } });
    return { deleted: true };
  }

  // ----- availability -----

  async upsertAvailability(
    roomId: string,
    dto: AvailabilityBulkInput,
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    await this.db.$transaction(
      dto.dates.map((date) =>
        this.db.roomAvailability.upsert({
          where: { roomId_date: { roomId, date } },
          create: { roomId, date, status: dto.status },
          update: { status: dto.status },
        }),
      ),
    );
    return { updated: dto.dates.length };
  }

  // ----- shared room-scoped helpers -----

  private async assertCanManage(
    hotelId: string,
    actor: CatalogActor,
  ): Promise<void> {
    await this.scope.assertManagerOwnsHotel(actor.sub, actor.role, hotelId);
  }

  private async assertCanManageRoom(
    roomId: string,
    actor: CatalogActor,
  ): Promise<void> {
    const room = await this.db.room.findUnique({
      where: { id: roomId },
      select: { hotelId: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    await this.assertCanManage(room.hotelId, actor);
  }

  private async getManagedRoom(roomId: string, actor: CatalogActor) {
    const room = await this.db.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    await this.assertCanManage(room.hotelId, actor);
    return room;
  }

  private async assertCityExists(cityId: string): Promise<void> {
    const city = await this.db.city.findUnique({
      where: { id: cityId },
      select: { id: true },
    });
    if (!city) throw new BadRequestException(`Unknown cityId "${cityId}"`);
  }

  private async assertAmenityExists(amenityId: string): Promise<void> {
    const amenity = await this.db.amenity.findUnique({
      where: { id: amenityId },
      select: { id: true },
    });
    if (!amenity) {
      throw new BadRequestException(`Unknown amenityId "${amenityId}"`);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
