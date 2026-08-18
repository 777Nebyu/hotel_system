import { createZodDto } from 'nestjs-zod';
import {
  attachAmenitySchema,
  availabilityBulkSchema,
  availabilityWindowSchema,
  createHotelSchema,
  createRoomSchema,
  hotelAmenityParamsSchema,
  hotelIdParamsSchema,
  imageIdParamsSchema,
  roomAmenityParamsSchema,
  roomIdParamsSchema,
  roomImageParamsSchema,
  searchHotelsSchema,
  seasonalPricingParamsSchema,
  seasonalPricingSchema,
  updateHotelSchema,
  updateRoomSchema,
} from '@repo/shared-types';

export class CreateHotelDto extends createZodDto(createHotelSchema) {}
export class UpdateHotelDto extends createZodDto(updateHotelSchema) {}
export class CreateRoomDto extends createZodDto(createRoomSchema) {}
export class UpdateRoomDto extends createZodDto(updateRoomSchema) {}
export class SeasonalPricingDto extends createZodDto(seasonalPricingSchema) {}
export class AvailabilityBulkDto extends createZodDto(availabilityBulkSchema) {}
export class SearchHotelsDto extends createZodDto(searchHotelsSchema) {}
export class AvailabilityWindowDto extends createZodDto(
  availabilityWindowSchema,
) {}
export class AttachAmenityDto extends createZodDto(attachAmenitySchema) {}

// ----- Params -----

export class HotelIdParamsDto extends createZodDto(hotelIdParamsSchema) {}
export class RoomIdParamsDto extends createZodDto(roomIdParamsSchema) {}
export class ImageIdParamsDto extends createZodDto(imageIdParamsSchema) {}
export class SeasonalPricingParamsDto extends createZodDto(
  seasonalPricingParamsSchema,
) {}
export class HotelAmenityParamsDto extends createZodDto(
  hotelAmenityParamsSchema,
) {}
export class RoomAmenityParamsDto extends createZodDto(
  roomAmenityParamsSchema,
) {}
export class RoomImageParamsDto extends createZodDto(roomImageParamsSchema) {}
