export interface HotelSummary {
  id: string;
  name: string;
  description: string;
  address: string;
  starRating: number;
  city: { id: string; name: string; country: { name: string } };
  primaryImageUrl: string | null;
  minPricePerNight: number | null;
  averageRating: number | null;
  reviewCount: number;
  amenities: string[];
}

export interface RoomPayload {
  id: string;
  roomNumber: string;
  type: string;
  capacity: number;
  beds: number;
  bathroom: number;
  basePrice: number;
  status: string;
  description: string | null;
  primaryImageUrl: string | null;
  amenities: string[];
}

export interface RoomWithAvailability extends RoomPayload {
  availableAcrossRange: boolean;
  availableNights: number;
  totalNights: number;
  priceRange: { min: number; max: number } | null;
}

export interface HotelDetail {
  id: string;
  name: string;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  starRating: number;
  status: string;
  city: { id: string; name: string; country: { id: string; name: string } };
  images: { id: string; url: string; isPrimary: boolean }[];
  amenities: string[];
  rooms: RoomPayload[];
  averageRating: number | null;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}
