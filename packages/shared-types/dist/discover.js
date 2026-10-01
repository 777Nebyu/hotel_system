"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchPlacesQuerySchema = exports.nearbyPlacesQuerySchema = exports.emergencyContactSchema = exports.placeSchema = exports.sourceSchema = exports.placeStatusSchema = exports.placeCategorySchema = void 0;
const zod_1 = require("zod");
exports.placeCategorySchema = zod_1.z.enum([
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
exports.placeStatusSchema = zod_1.z.enum([
    'DRAFT',
    'PENDING_REVIEW',
    'PUBLISHED',
    'ARCHIVED',
]);
exports.sourceSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    url: zod_1.z.string().nullable().optional(),
    license: zod_1.z.string().nullable().optional(),
    verifiedBy: zod_1.z.string().nullable().optional(),
    createdAt: zod_1.z.string().or(zod_1.z.date()),
    updatedAt: zod_1.z.string().or(zod_1.z.date()),
});
exports.placeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    amharicName: zod_1.z.string().nullable().optional(),
    description: zod_1.z.string(),
    amharicDescription: zod_1.z.string().nullable().optional(),
    category: exports.placeCategorySchema,
    status: exports.placeStatusSchema,
    address: zod_1.z.string(),
    lat: zod_1.z.number(),
    lng: zod_1.z.number(),
    cityId: zod_1.z.string().nullable().optional(),
    phone: zod_1.z.string().nullable().optional(),
    website: zod_1.z.string().nullable().optional(),
    openingHours: zod_1.z.string().nullable().optional(),
    hoursVerified: zod_1.z.boolean(),
    priceLevel: zod_1.z.number().nullable().optional(),
    rating: zod_1.z.number().nullable().optional(),
    images: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    sourceId: zod_1.z.string().nullable().optional(),
    source: exports.sourceSchema.nullable().optional(),
    lastVerifiedAt: zod_1.z.string().or(zod_1.z.date()).nullable().optional(),
    distanceKm: zod_1.z.number().optional(), // Computed dynamically for nearby queries
    walkingTimeMin: zod_1.z.number().optional(),
    createdAt: zod_1.z.string().or(zod_1.z.date()),
    updatedAt: zod_1.z.string().or(zod_1.z.date()),
});
exports.emergencyContactSchema = zod_1.z.object({
    id: zod_1.z.string(),
    city: zod_1.z.string().nullable().optional(),
    hotelId: zod_1.z.string().nullable().optional(),
    kind: zod_1.z.string(), // POLICE | AMBULANCE | FIRE | HOTEL | EMBASSY | OTHER
    name: zod_1.z.string(),
    phone: zod_1.z.string(),
    sourceId: zod_1.z.string().nullable().optional(),
    source: exports.sourceSchema.nullable().optional(),
    lastVerifiedAt: zod_1.z.string().or(zod_1.z.date()),
    status: zod_1.z.string(),
    createdAt: zod_1.z.string().or(zod_1.z.date()),
    updatedAt: zod_1.z.string().or(zod_1.z.date()),
});
exports.nearbyPlacesQuerySchema = zod_1.z.object({
    lat: zod_1.z.coerce.number().min(-90).max(90),
    lng: zod_1.z.coerce.number().min(-180).max(180),
    radiusKm: zod_1.z.coerce.number().positive().max(50).default(5),
    category: exports.placeCategorySchema.optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.searchPlacesQuerySchema = zod_1.z.object({
    q: zod_1.z.string().min(1).max(100),
    category: exports.placeCategorySchema.optional(),
    cityId: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(20),
});
