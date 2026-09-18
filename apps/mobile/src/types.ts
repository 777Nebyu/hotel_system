import type {
  UserRole,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  RoomType,
  RoomStatus,
  HotelStatus,
  Paginated,
} from '@repo/shared-types';

export type {
  UserRole,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  RoomType,
  RoomStatus,
  HotelStatus,
  Paginated,
};

export interface User {
  id: string; email: string; fullName: string; phone?: string | null;
  role: UserRole; profilePhotoUrl?: string | null; isActive?: boolean;
  emailVerifiedAt?: string | null;
  /** Primary managed/assigned hotel ID (MANAGER / STAFF) */
  hotelId?: string;
  /** Primary managed/assigned hotel name (MANAGER / STAFF) */
  hotelName?: string;
}

export interface HotelSummary {
  id: string; name: string; description: string; address: string;
  city: { id: string; name: string; country?: { name: string } };
  starRating: number; primaryImageUrl: string | null;
  minPricePerNight: number | null; averageRating: number | null;
  reviewCount: number; amenities: string[];
}

export interface Hotel extends HotelSummary {
  status: HotelStatus; lat: number | null; lng: number | null;
  images: { id: string; url: string; isPrimary: boolean }[];
  rooms: Room[];
}

export interface Room {
  id: string; roomNumber: string; type: RoomType; capacity: number;
  beds: number; bathroom: number; basePrice: number | string;
  status: RoomStatus;
  description?: string | null; amenities: string[];
}

export interface BookingQuote {
  hotel: { id: string; name: string }; checkIn: string; checkOut: string; nights: number;
  rooms: Array<{ roomId: string; roomNumber: string; nightly: number[]; subtotal: number }>;
  subtotal: number; taxRate: number; taxAmount: number; serviceFee: number; discount: number; total: number; promoCode?: string;
}

export interface Booking {
  id: string; userId: string; hotelId: string;
  hotel?: { id: string; name: string; address?: string; images?: { url: string }[] };
  checkIn: string; checkOut: string;
  status: BookingStatus;
  totalPrice: number | string; createdAt: string;
  cancellationHours?: number;
  reference?: string;
  details?: BookingDetail[]; payment?: Payment;
  actualCheckIn?: string | null; actualCheckOut?: string | null;
  earlyCheckIn?: boolean | null; lateCheckOut?: boolean | null;
  earlyCheckInFee?: number | string | null; lateCheckOutFee?: number | string | null;
}

export interface BookingDetail {
  id: string; bookingId: string; roomId: string;
  room?: Room; guestCount: number;
  guestInfo: { fullName?: string; email?: string; phone?: string; nationality?: string; idPassport?: string } | null;
}

export interface Payment {
  id: string; bookingId: string; method: PaymentMethod; amount: number | string;
  status: PaymentStatus;
  providerRef?: string | null; createdAt: string;
}

export interface Review {
  id: string; userId: string; hotelId: string; rating: number; comment: string;
  photos?: string[] | null; createdAt: string;
  user?: User; hotel?: { id: string; name: string };
}

export interface FavoriteHotel {
  id: string; name: string; address: string;
  city: { id: string; name: string; country?: { name: string } };
  starRating: number; primaryImageUrl: string | null;
  minPricePerNight: number | null; averageRating: number | null; reviewCount: number;
}

export interface Notification {
  id: string; userId: string; type: string; channel: string;
  payload: Record<string, unknown>;
  sentAt?: string | null; readAt?: string | null; createdAt: string;
}
