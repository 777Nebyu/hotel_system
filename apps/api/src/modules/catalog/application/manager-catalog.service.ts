import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HotelStatus, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../common/services/audit.service';
import { ResourceScopeHelper } from '../../../common/guards/resource-scope.helper';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../../../common/storage/storage';
import type {
  AvailabilityBulkInput,
  BlockMaintenanceInput,
  CreateHotelInput,
  CreateRoomInput,
  SeasonalPricingInput,
  UpdateHotelInput,
  UpdateRoomInput,
  UpsertHotelPolicyInput,
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
    private readonly audit: AuditService,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
  ) {}

  async myHotels(userId: string) {
    return this.db.hotel.findMany({
      where: { managerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        city: { include: { country: true } },
        images: true,
        policy: true,
        _count: { select: { bookings: true, rooms: true } },
      },
    });
  }

  async createHotel(dto: CreateHotelInput, actor: CatalogActor) {
    await this.assertCityExists(dto.cityId);
    const managerId =
      actor.role === 'ADMIN' ? (dto.managerId ?? null) : actor.sub;
    const initialStatus =
      actor.role === 'ADMIN' && dto.status
        ? (dto.status as HotelStatus)
        : HotelStatus.PENDING_APPROVAL;

    const hotel = await this.db.hotel.create({
      data: {
        name: dto.name,
        description: dto.description,
        cityId: dto.cityId,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        starRating: dto.starRating ?? 3,
        status: initialStatus,
        managerId,
      },
      include: {
        city: { include: { country: true } },
        images: true,
        policy: true,
      },
    });
    await this.audit.record(actor.sub, 'hotel.create', 'Hotel', hotel.id, {
      name: hotel.name,
      status: hotel.status,
    });
    return hotel;
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
    if (dto.status !== undefined && actor.role === 'ADMIN') {
      data.status = dto.status as HotelStatus;
    }
    if (dto.rejectionReason !== undefined && actor.role === 'ADMIN') {
      data.rejectionReason = dto.rejectionReason;
    }
    if (dto.managerId !== undefined && actor.role === 'ADMIN') {
      data.manager = { connect: { id: dto.managerId } };
    }
    const hotel = await this.db.hotel.update({
      where: { id },
      data,
      include: {
        city: { include: { country: true } },
        images: true,
        policy: true,
      },
    });
    await this.audit.record(
      actor.sub,
      'hotel.update',
      'Hotel',
      id,
      dto as unknown as Prisma.InputJsonValue,
    );
    return hotel;
  }

  async deleteHotel(id: string, actor: CatalogActor) {
    await this.assertCanManage(id, actor);
    await this.db.hotel.delete({ where: { id } });
    await this.audit.record(actor.sub, 'hotel.delete', 'Hotel', id, {});
    return { deleted: true };
  }

  async getHotelPolicy(hotelId: string, actor: CatalogActor) {
    await this.assertCanManage(hotelId, actor);
    const policy = await this.db.hotelPolicy.findUnique({
      where: { hotelId },
    });
    if (!policy) {
      return {
        hotelId,
        checkInTime: '14:00',
        checkOutTime: '11:00',
        cancellationWindowDays: 3,
        cancellationFeePercent: 0,
        allowEarlyCheckIn: true,
        earlyCheckInFee: 0,
        allowLateCheckOut: true,
        lateCheckOutFee: 0,
      };
    }
    return policy;
  }

  async upsertHotelPolicy(
    hotelId: string,
    dto: UpsertHotelPolicyInput,
    actor: CatalogActor,
  ) {
    await this.assertCanManage(hotelId, actor);
    const policy = await this.db.hotelPolicy.upsert({
      where: { hotelId },
      create: {
        hotelId,
        checkInTime: dto.checkInTime,
        checkOutTime: dto.checkOutTime,
        cancellationWindowDays: dto.cancellationWindowDays,
        cancellationFeePercent: dto.cancellationFeePercent,
        allowEarlyCheckIn: dto.allowEarlyCheckIn,
        earlyCheckInFee: dto.earlyCheckInFee,
        allowLateCheckOut: dto.allowLateCheckOut,
        lateCheckOutFee: dto.lateCheckOutFee,
      },
      update: {
        checkInTime: dto.checkInTime,
        checkOutTime: dto.checkOutTime,
        cancellationWindowDays: dto.cancellationWindowDays,
        cancellationFeePercent: dto.cancellationFeePercent,
        allowEarlyCheckIn: dto.allowEarlyCheckIn,
        earlyCheckInFee: dto.earlyCheckInFee,
        allowLateCheckOut: dto.allowLateCheckOut,
        lateCheckOutFee: dto.lateCheckOutFee,
      },
    });
    await this.audit.record(
      actor.sub,
      'hotel.policy.update',
      'HotelPolicy',
      policy.id,
      dto as unknown as Prisma.InputJsonValue,
    );
    return policy;
  }

  async addHotelImages(
    hotelId: string,
    files: Express.Multer.File[],
    actor: CatalogActor,
  ) {
    await this.assertCanManage(hotelId, actor);
    if (!files.length) return [];
    const hasPrimary = await this.db.hotelImage.findFirst({
      where: { hotelId, isPrimary: true },
      select: { id: true },
    });
    const records: { hotelId: string; url: string; isPrimary: boolean }[] = [];
    for (let i = 0; i < files.length; i++) {
      const uploaded = await this.storage.upload(files[i], 'hotels');
      records.push({
        hotelId,
        url: uploaded.url,
        isPrimary: !hasPrimary && i === 0,
      });
    }
    await this.db.hotelImage.createMany({ data: records });
    return this.db.hotelImage.findMany({ where: { hotelId } });
  }

  async setPrimaryHotelImage(
    hotelId: string,
    imageId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManage(hotelId, actor);
    await this.db.$transaction([
      this.db.hotelImage.updateMany({
        where: { hotelId },
        data: { isPrimary: false },
      }),
      this.db.hotelImage.update({
        where: { id: imageId, hotelId },
        data: { isPrimary: true },
      }),
    ]);
    return { success: true };
  }

  async removeHotelImage(
    hotelId: string,
    imageId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManage(hotelId, actor);
    const img = await this.db.hotelImage.findUnique({ where: { id: imageId } });
    if (img) {
      await this.storage.remove({ url: img.url, publicId: null });
      await this.db.hotelImage.delete({ where: { id: imageId } });
    }
    return { deleted: true };
  }

  async attachHotelAmenity(
    hotelId: string,
    amenityId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManage(hotelId, actor);
    await this.assertAmenityExists(amenityId);
    try {
      return await this.db.hotelAmenity.create({
        data: { hotelId, amenityId },
      });
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException('Amenity already attached to hotel');
      }
      throw e;
    }
  }

  async detachHotelAmenity(
    hotelId: string,
    amenityId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManage(hotelId, actor);
    await this.db.hotelAmenity.delete({
      where: { hotelId_amenityId: { hotelId, amenityId } },
    });
    return { deleted: true };
  }

  async createRoom(
    hotelId: string,
    dto: CreateRoomInput,
    actor: CatalogActor,
  ) {
    await this.assertCanManage(hotelId, actor);
    try {
      return await this.db.room.create({
        data: {
          hotelId,
          roomNumber: dto.roomNumber,
          type: dto.type,
          capacity: dto.capacity,
          beds: dto.beds,
          bathroom: dto.bathroom,
          basePrice: dto.basePrice,
          status: dto.status,
          description: dto.description,
        },
      });
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException(
          `Room "${dto.roomNumber}" already exists in this hotel`,
        );
      }
      throw e;
    }
  }

  async updateRoom(roomId: string, dto: UpdateRoomInput, actor: CatalogActor) {
    await this.assertCanManageRoom(roomId, actor);
    const data: Prisma.RoomUpdateInput = {};
    if (dto.roomNumber !== undefined) data.roomNumber = dto.roomNumber;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.beds !== undefined) data.beds = dto.beds;
    if (dto.bathroom !== undefined) data.bathroom = dto.bathroom;
    if (dto.basePrice !== undefined) data.basePrice = dto.basePrice;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.description !== undefined) data.description = dto.description;
    try {
      return await this.db.room.update({ where: { id: roomId }, data });
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException(
          `Room "${dto.roomNumber}" already exists in this hotel`,
        );
      }
      throw e;
    }
  }

  async deleteRoom(roomId: string, actor: CatalogActor) {
    await this.assertCanManageRoom(roomId, actor);
    await this.db.room.delete({ where: { id: roomId } });
    return { deleted: true };
  }

  async addRoomImages(
    roomId: string,
    files: Express.Multer.File[],
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    if (!files.length) return [];
    const hasPrimary = await this.db.roomImage.findFirst({
      where: { roomId, isPrimary: true },
      select: { id: true },
    });
    const records: { roomId: string; url: string; isPrimary: boolean }[] = [];
    for (let i = 0; i < files.length; i++) {
      const uploaded = await this.storage.upload(files[i], 'rooms');
      records.push({
        roomId,
        url: uploaded.url,
        isPrimary: !hasPrimary && i === 0,
      });
    }
    await this.db.roomImage.createMany({ data: records });
    return this.db.roomImage.findMany({ where: { roomId } });
  }

  async setPrimaryRoomImage(
    roomId: string,
    imageId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    await this.db.$transaction([
      this.db.roomImage.updateMany({
        where: { roomId },
        data: { isPrimary: false },
      }),
      this.db.roomImage.update({
        where: { id: imageId, roomId },
        data: { isPrimary: true },
      }),
    ]);
    return { success: true };
  }

  async removeRoomImage(
    roomId: string,
    imageId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    const img = await this.db.roomImage.findUnique({ where: { id: imageId } });
    if (img) {
      await this.storage.remove({ url: img.url, publicId: null });
      await this.db.roomImage.delete({ where: { id: imageId } });
    }
    return { deleted: true };
  }

  async attachRoomAmenity(
    roomId: string,
    amenityId: string,
    actor: CatalogActor,
  ) {
    await this.assertCanManageRoom(roomId, actor);
    await this.assertAmenityExists(amenityId);
    try {
      return await this.db.roomAmenity.create({
        data: { roomId, amenityId },
      });
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException('Amenity already attached to room');
      }
      throw e;
    }
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
    await this.db.seasonalPricing.delete({
      where: { id: pricingId, roomId },
    });
    return { deleted: true };
  }

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

  async blockMaintenance(dto: BlockMaintenanceInput, actor: CatalogActor) {
    const roomIds = dto.roomIds && dto.roomIds.length > 0
      ? dto.roomIds
      : dto.roomId
        ? [dto.roomId]
        : [];

    if (!roomIds.length) {
      throw new BadRequestException('No room specified for maintenance blocking');
    }

    for (const rid of roomIds) {
      await this.assertCanManageRoom(rid, actor);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    const conflictingBookings = await this.db.bookingDetail.findMany({
      where: {
        roomId: { in: roomIds },
        booking: {
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          checkIn: { lt: endDate },
          checkOut: { gt: startDate },
        },
      },
      include: {
        room: { select: { roomNumber: true } },
      },
    });

    if (conflictingBookings.length > 0) {
      const roomNums = Array.from(
        new Set(conflictingBookings.map((cb) => cb.room.roomNumber)),
      );
      throw new ConflictException(
        `Cannot block maintenance: Room(s) ${roomNums.join(', ')} have active bookings in the selected date range`,
      );
    }

    const dates: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    await this.db.$transaction(
      roomIds.flatMap((roomId) =>
        dates.map((date) =>
          this.db.roomAvailability.upsert({
            where: { roomId_date: { roomId, date } },
            create: { roomId, date, status: 'MAINTENANCE' },
            update: { status: 'MAINTENANCE' },
          }),
        ),
      ),
    );

    return {
      success: true,
      blockedRooms: roomIds.length,
      blockedDatesPerRoom: dates.length,
      totalEntries: roomIds.length * dates.length,
    };
  }

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
