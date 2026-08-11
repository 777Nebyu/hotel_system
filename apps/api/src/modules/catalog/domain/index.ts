export type {
  Country,
  City,
  Hotel,
  Room,
  Amenity,
  RoomAvailability,
} from '../../../generated/prisma/client';

export const HOTEL_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export const ROOM_TYPES = [
  'STANDARD',
  'DELUXE',
  'SUITE',
  'FAMILY',
  'EXECUTIVE',
] as const;
