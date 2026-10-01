import { z } from 'zod';

export const placeCategorySchema = z.enum([
  'RESTAURANT',
  'CAFE',
  'HERITAGE',
  'MUSEUM',
  'ATTRACTION',
  'NIGHTLIFE',
  'SHOPPING',
  'HOSPITAL',
  'CLINIC',
  'PHARMACY',
  'EMERGENCY',
  'OTHER',
]);
export type PlaceCategory = z.infer<typeof placeCategorySchema>;

export const placeStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'ARCHIVED',
]);
export type PlaceStatus = z.infer<typeof placeStatusSchema>;

export const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  verifiedBy: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type Source = z.infer<typeof sourceSchema>;

export const placeSchema = z.object({
  id: z.string(),
  name: z.string(),
  amharicName: z.string().nullable().optional(),
  description: z.string(),
  amharicDescription: z.string().nullable().optional(),
  category: placeCategorySchema,
  status: placeStatusSchema,
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  cityId: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  openingHours: z.string().nullable().optional(),
  hoursVerified: z.boolean(),
  priceLevel: z.number().nullable().optional(),
  rating: z.number().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  sourceId: z.string().nullable().optional(),
  source: sourceSchema.nullable().optional(),
  lastVerifiedAt: z.string().or(z.date()).nullable().optional(),
  distanceKm: z.number().optional(), // Computed dynamically for nearby queries
  walkingTimeMin: z.number().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type Place = z.infer<typeof placeSchema>;

export const emergencyContactSchema = z.object({
  id: z.string(),
  city: z.string().nullable().optional(),
  hotelId: z.string().nullable().optional(),
  kind: z.string(), // POLICE | AMBULANCE | FIRE | HOTEL | EMBASSY | OTHER
  name: z.string(),
  phone: z.string(),
  sourceId: z.string().nullable().optional(),
  source: sourceSchema.nullable().optional(),
  lastVerifiedAt: z.string().or(z.date()),
  status: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;

export const nearbyPlacesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(50).default(5),
  category: placeCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type NearbyPlacesQuery = z.infer<typeof nearbyPlacesQuerySchema>;

export const searchPlacesQuerySchema = z.object({
  q: z.string().min(1).max(100),
  category: placeCategorySchema.optional(),
  cityId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchPlacesQuery = z.infer<typeof searchPlacesQuerySchema>;
