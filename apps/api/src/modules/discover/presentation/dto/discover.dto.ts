import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  nearbyPlacesQuerySchema,
  placeCategorySchema,
  searchPlacesQuerySchema,
} from '@repo/shared-types';

export class NearbyPlacesQueryDto extends createZodDto(
  nearbyPlacesQuerySchema,
) {}
export class SearchPlacesQueryDto extends createZodDto(
  searchPlacesQuerySchema,
) {}

const heritageQuerySchema = z.object({
  cityId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export class HeritageQueryDto extends createZodDto(heritageQuerySchema) {}

const emergencyContactsQuerySchema = z.object({
  city: z.string().optional(),
  hotelId: z.string().optional(),
});
export class EmergencyContactsQueryDto extends createZodDto(
  emergencyContactsQuerySchema,
) {}

const createPlaceSchema = z.object({
  name: z.string().min(2).max(150),
  amharicName: z.string().max(150).optional(),
  description: z.string().min(10),
  amharicDescription: z.string().optional(),
  category: placeCategorySchema,
  address: z.string().min(3),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  cityId: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  openingHours: z.string().optional(),
  hoursVerified: z.boolean().default(false),
  priceLevel: z.number().int().min(1).max(4).default(1),
  rating: z.number().min(1).max(5).default(4.5),
  images: z.array(z.string()).optional(),
  // Every place shown publicly must be attributable to a verified source.
  sourceId: z.string().min(1),
});
export class CreatePlaceDto extends createZodDto(createPlaceSchema) {}
