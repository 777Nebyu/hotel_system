export interface User {
  id: string
  email: string
  fullName: string
  phone?: string | null
  role: 'CUSTOMER' | 'STAFF' | 'MANAGER' | 'ADMIN'
  isActive: boolean
  profilePhotoUrl?: string | null
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface Paginated<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
    pageCount: number
  }
}

export interface HotelSummary {
  id: string
  name: string
  description: string
  address: string
  city: { id: string; name: string; country: { name: string } }
  starRating: number
  primaryImageUrl: string | null
  minPricePerNight: number | null
  averageRating: number | null
  reviewCount: number
  amenities: string[]
}

export interface Hotel extends Omit<HotelSummary, 'primaryImageUrl' | 'minPricePerNight' | 'amenities'> {
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'INACTIVE' | 'PENDING'
  lat: number | null
  lng: number | null
  images: HotelImage[]
  amenities: string[]
  rooms: Room[]
  createdAt: string
  updatedAt: string
}

export interface HotelImage {
  id: string
  url: string
  isPrimary: boolean
}

export interface Room {
  id: string
  roomNumber: string
  type: string
  capacity: number
  beds: number
  bathroom: number
  basePrice: number | string
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'MAINTENANCE' | 'CLEANING'
  description?: string | null
  primaryImageUrl?: string | null
  images?: HotelImage[]
  amenities: string[]
}

export interface OperationalRoom extends Room {
  hotelId: string
  isOccupied: boolean
  currentGuest: string | null
  currentGuestPhone: string | null
  currentBookingId: string | null
  currentBookingRef: string | null
  checkInDate: string | null
  checkOutDate: string | null
}

export interface RoomAvailability extends Room {
  availableAcrossRange: boolean
  availableNights: number
  totalNights: number
  priceRange: { min: number; max: number } | null
}

export interface BookingQuote {
  hotel: { id: string; name: string }
  checkIn: string
  checkOut: string
  nights: number
  rooms: Array<{
    roomId: string
    roomNumber: string
    pricePerNight?: number
    nights?: number
    roomTotal?: number
    nightly?: number[]
    subtotal?: number
  }>
  subtotal: number
  taxRate?: number
  taxAmount?: number
  serviceFee?: number
  discount: number
  total: number
  couponCode?: string
}

export interface Booking {
  id: string
  userId: string
  hotelId: string
  hotel?: { id: string; name: string; address?: string; images?: HotelImage[] }
  checkIn: string
  checkOut: string
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'REJECTED'
  totalPrice: number | string
  createdAt: string
  details?: BookingDetail[]
  payment?: Payment
}

export interface BookingDetail {
  id: string
  bookingId: string
  roomId: string
  room?: Room
  guestCount: number
  guestInfo: any
}

export interface Payment {
  id: string
  bookingId: string
  method: string
  amount: number | string
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED'
  providerRef?: string | null
  invoiceUrl?: string | null
  createdAt: string
  booking?: { id: string; hotel?: { id: string; name: string } }
}

export interface Review {
  id: string
  userId: string
  user?: User
  hotelId: string
  rating: number
  comment: string
  photos?: string[] | null
  response?: string | null
  respondedAt?: string | null
  respondedById?: string | null
  respondedBy?: { id: string; fullName: string; role: string } | null
  booking?: { id: string; bookingRef?: string; checkIn?: string; checkOut?: string } | null
  createdAt: string
  hotel?: { id: string; name: string; address?: string }
}

export interface ManagerReviewsResponse extends Paginated<Review> {
  summary: {
    averageRating: number | null
    reviewCount: number
    respondedCount: number
    pendingResponseCount: number
  }
}


export interface FavoriteHotel extends Omit<HotelSummary, 'amenities'> {}

export interface Notification {
  id: string
  userId: string
  type: string
  channel: string
  payload: any
  sentAt?: string | null
  readAt?: string | null
  createdAt: string
}

export interface BookingsResponse { data: Booking[] }
export interface ReviewsResponse extends Paginated<Review> {
  summary: { averageRating: number | null; reviewCount: number }
}
export interface NotificationsResponse extends Paginated<Notification> { unreadCount: number }

export interface HotelPolicy {
  id: string
  hotelId: string
  checkInTime: string
  checkOutTime: string
  cancellationWindowDays?: number
  cancellationFeePercent?: number | string
  allowEarlyCheckIn?: boolean
  earlyCheckInFee?: number | string
  allowLateCheckOut?: boolean
  lateCheckOutFee?: number | string
  taxRate?: number | string | null
  rules?: string[]
  houseRules?: string | null
  cancellationHours?: number
  refundPercentage?: number
  depositRequired?: boolean
}

export interface SeasonalPricing {
  id: string
  roomId: string
  name: string
  startDate: string
  endDate: string
  priceMultiplier?: number | null
  fixedPrice?: number | null
  createdAt?: string
}

export interface HotelStaffMember {
  id: string
  hotelId: string
  userId: string
  createdAt: string
  user: {
    id: string
    fullName: string
    email: string
    phone?: string | null
    role: string
    isActive: boolean
  }
}

export interface HotelReportOverview {
  totalBookings: number
  confirmedBookings: number
  cancelledBookings: number
  totalRevenue: number
  occupancyRate: number
  activeRooms: number
}

export interface MonthlyRevenueItem {
  month: string
  revenue: number
  bookings: number
}

export interface DailyBookingTrendItem {
  date: string
  count: number
  revenue: number
}

export interface Coupon {
  id: string
  code: string
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED'
  value?: number | string
  discountValue?: number
  validFrom?: string
  validTo?: string
  startsAt?: string | null
  expiresAt?: string | null
  usageLimit?: number | null
  timesUsed?: number
  usageCount?: number
  isActive: boolean
  minBookingAmount?: number | string | null
  minSpend?: number | null
  maxDiscount?: number | null
  createdAt?: string
}

export interface PlatformSetting {
  id: string
  key: string
  value: any
  description?: string | null
  updatedAt?: string
}

export interface ContactThread {
  id: string
  hotelId: string
  hotel?: { id: string; name: string }
  userId: string
  user?: { id: string; fullName: string; email: string }
  subject: string
  status: 'OPEN' | 'CLOSED'
  messages: ContactMessage[]
  createdAt: string
  updatedAt: string
}

export interface ContactMessage {
  id: string
  threadId: string
  senderId: string
  senderRole: string
  content: string
  createdAt: string
}

export interface StayRequest {
  id: string
  bookingId: string
  type: 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT'
  requestedTime: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  fee?: number | null
  note?: string | null
  createdAt: string
}

export interface RoomHold {
  id: string
  roomId: string
  userId: string
  holdStart: string
  holdEnd: string
  status: string
}

export interface SessionItem {
  id: string
  deviceName?: string
  userAgent?: string | null
  ipAddress?: string | null
  lastActiveAt?: string
  lastUsedAt?: string | null
  createdAt: string
  isCurrent?: boolean
}