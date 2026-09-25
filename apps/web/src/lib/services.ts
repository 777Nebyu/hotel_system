import { API_BASE_URL, api } from './api'
import type {
  Booking,
  BookingQuote,
  BookingsResponse,
  ContactMessage,
  ContactThread,
  Coupon,
  DailyBookingTrendItem,
  FavoriteHotel,
  Hotel,
  HotelPolicy,
  HotelReportOverview,
  HotelStaffMember,
  HotelSummary,
  ManagerReviewsResponse,
  MonthlyRevenueItem,
  Notification,
  NotificationsResponse,
  OperationalRoom,
  Paginated,
  Payment,
  PlatformSetting,
  Review,
  ReviewsResponse,
  Room,
  RoomAvailability,
  RoomHold,
  SeasonalPricing,
  SessionItem,
  StayRequest,
  User,
} from './types'
import { useAuth } from './auth-store'

function getAuthToken() {
  return useAuth.getState().tokens?.accessToken
}

function query(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return ''
  const values = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => [key, String(value)] as [string, string])
  return values.length ? `?${new URLSearchParams(values).toString()}` : ''
}

export async function downloadReportFile(
  url: string,
  fallbackFileName: string,
): Promise<void> {
  const token = getAuthToken()
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Failed to download report')
    throw new Error(`Report export failed: ${errorText}`)
  }
  const blob = await res.blob()
  let fileName = fallbackFileName
  const disposition = res.headers.get('content-disposition')
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/)
    if (match?.[1]) fileName = match[1]
  }
  const blobUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(blobUrl)
}

export const authApi = {
  register: (data: { email: string; password: string; fullName: string; phone?: string }) =>
    api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', data),
  forgot: (email: string) => api.post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; password: string }) =>
    api.post<{ message: string }>('/auth/reset-password', data),
  verifyEmail: (token: string) =>
    api.post<{ message: string; verified?: boolean }>(`/auth/verify-email/${encodeURIComponent(token)}`),
  listSessions: () => api.get<SessionItem[]>('/auth/sessions', getAuthToken()),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`, getAuthToken()),
  revokeAllOtherSessions: () => api.delete('/auth/sessions', getAuthToken()),
  deactivate: (reason?: string) => api.post('/auth/me/deactivate', { reason }, getAuthToken()),
}

export const profileApi = {
  get: () => api.get<User>('/auth/me', getAuthToken()),
  update: (data: Partial<Pick<User, 'fullName' | 'phone'>> & { currentPassword?: string; newPassword?: string }) =>
    api.patch<User>('/auth/me', data, getAuthToken()),
  uploadPhoto: (file: File) => {
    const form = new FormData()
    form.append('photo', file)
    return api.postForm<User>('/auth/me/photo', form, getAuthToken())
  },
}

export const hotelApi = {
  search: (params: Record<string, string | number | boolean | undefined> = {}) => {
    return api.get<Paginated<HotelSummary>>(`/catalog/hotels${query(params)}`)
  },
  getById: (id: string) => api.get<Hotel>(`/catalog/hotels/${id}`),
  getRooms: (hotelId: string, params?: Record<string, string | number | undefined>) => {
    return api.get<RoomAvailability[]>(`/catalog/hotels/${hotelId}/rooms${query(params)}`)
  },
  getPolicy: (hotelId: string) => api.get<HotelPolicy>(`/catalog/hotels/${hotelId}/policy`, getAuthToken()),
  countries: () =>
    api.get<Array<{ id: string; name: string; code: string; cities?: Array<{ id: string; name: string }> }>>(
      '/catalog/countries',
    ),
  cities: (country?: string) => api.get<Array<{ id: string; name: string }>>(`/catalog/cities${query({ country })}`),
  amenities: () => api.get<Array<{ id: string; name: string }>>('/catalog/amenities'),
}

export const bookingApi = {
  checkout: (data: {
    hotelId: string
    roomIds: string[]
    checkIn: string
    checkOut: string
    guests: { adults: number; children: number }
    promoCode?: string
  }) => api.post<BookingQuote>('/bookings/checkout', data, getAuthToken()),
  create: (data: any) => api.post<Booking>('/bookings', data, getAuthToken()),
  myBookings: (scope?: string) => {
    return api.get<BookingsResponse>(`/bookings/my${query({ scope })}`, getAuthToken())
  },
  cancel: (id: string) => api.post<Booking>(`/bookings/${id}/cancel`, undefined, getAuthToken()),
  cancelRooms: (id: string, roomIds: string[]) =>
    api.post(`/bookings/${id}/cancel-rooms`, { roomIds }, getAuthToken()),
  invoiceUrl: (id: string) => `${API_BASE_URL}/bookings/${id}/invoice`,
  createHold: (data: { roomId: string; checkIn: string; checkOut: string }) =>
    api.post<RoomHold>('/bookings/holds', data, getAuthToken()),
  releaseHold: (holdId: string) => api.delete(`/bookings/holds/${holdId}`, getAuthToken()),
  createStayRequest: (bookingId: string, data: { type: 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT'; requestedTime: string; note?: string }) =>
    api.post<StayRequest>(`/bookings/${bookingId}/stay-requests`, data, getAuthToken()),
  getStayRequests: (bookingId: string) =>
    api.get<StayRequest[]>(`/bookings/${bookingId}/stay-requests`, getAuthToken()),
  modifyQuote: (bookingId: string, data: any) =>
    api.post(`/bookings/${bookingId}/modify-quote`, data, getAuthToken()),
  modify: (bookingId: string, data: any) =>
    api.post(`/bookings/${bookingId}/modify`, data, getAuthToken()),
}

export const paymentApi = {
  mine: () => api.get<{ data: Payment[] }>('/payments/my', getAuthToken()),
  intent: (bookingId: string, method: 'CREDIT_CARD' | 'PAYPAL' | 'TELEBIRR' | 'CBE_BIRR' | 'CASH') =>
    api.post<{ paymentId: string; bookingId: string; amount: number; status: string; redirectUrl?: string }>(
      `/payments/${bookingId}/intent`,
      { method },
      getAuthToken(),
    ),
  mockCallback: (
    bookingId: string,
    data?: { reference?: string; transactionId?: string; message?: string },
    secret = 'development-mock-payment-secret',
  ) =>
    api.post(
      `/payments/mock/${bookingId}`,
      data ?? {},
      undefined,
      { headers: { 'x-mock-payment-secret': secret } },
    ),
  markCashPaid: (bookingId: string, reference?: string) =>
    api.post(`/payments/${bookingId}/cash-paid`, { reference }, getAuthToken()),
  refund: (bookingId: string) => api.post(`/payments/${bookingId}/refund`, undefined, getAuthToken()),
}

export const reviewApi = {
  create: (data: { hotelId: string; rating: number; comment: string; bookingId?: string }) =>
    api.post<Review>('/reviews', data, getAuthToken()),
  forHotel: (hotelId: string, page = 1) =>
    api.get<ReviewsResponse>(`/hotels/${hotelId}/reviews${query({ page })}`),
  mine: () => api.get<Review[]>('/reviews/my', getAuthToken()),
  remove: (id: string) => api.delete(`/reviews/${id}`, getAuthToken()),
}

export const favoriteApi = {
  list: () => api.get<FavoriteHotel[]>('/favorites/my', getAuthToken()),
  add: (hotelId: string) => api.post(`/favorites/${hotelId}`, undefined, getAuthToken()),
  remove: (hotelId: string) => api.delete(`/favorites/${hotelId}`, getAuthToken()),
}

export const notificationApi = {
  list: (page = 1) => api.get<NotificationsResponse>(`/notifications${query({ page })}`, getAuthToken()),
  markRead: (id: string) => api.post(`/notifications/${id}/read`, undefined, getAuthToken()),
  markAllRead: () => api.post('/notifications/read-all', undefined, getAuthToken()),
}

export const contactApi = {
  createThread: (hotelId: string, data: { subject: string; message: string }) =>
    api.post<ContactThread>(`/hotels/${hotelId}/contact`, data, getAuthToken()),
  listThreads: (hotelId?: string) =>
    api.get<ContactThread[]>(`/contact/threads${query({ hotelId })}`, getAuthToken()),
  getThread: (threadId: string) =>
    api.get<ContactThread>(`/contact/threads/${threadId}`, getAuthToken()),
  sendMessage: (threadId: string, content: string) =>
    api.post<ContactMessage>(`/contact/threads/${threadId}/messages`, { content }, getAuthToken()),
  updateStatus: (threadId: string, status: 'OPEN' | 'CLOSED') =>
    api.patch(`/contact/threads/${threadId}/status`, { status }, getAuthToken()),
}

export const managerApi = {
  hotels: () => api.get<Hotel[]>('/catalog/manager/hotels', getAuthToken()),
  createHotel: (data: any) => api.post<Hotel>('/catalog/hotels', data, getAuthToken()),
  updateHotel: (id: string, data: any) => api.patch<Hotel>(`/catalog/hotels/${id}`, data, getAuthToken()),
  deleteHotel: (id: string) => api.delete(`/catalog/hotels/${id}`, getAuthToken()),
  getPolicy: (hotelId: string) => api.get<HotelPolicy>(`/catalog/hotels/${hotelId}/policy`, getAuthToken()),
  upsertPolicy: (hotelId: string, data: Partial<HotelPolicy>) =>
    api.put<HotelPolicy>(`/catalog/hotels/${hotelId}/policy`, data, getAuthToken()),
  addHotelImages: (hotelId: string, files: File[]) => {
    const form = new FormData()
    files.forEach((file) => form.append('images', file))
    return api.postForm(`/catalog/hotels/${hotelId}/images`, form, getAuthToken())
  },
  setPrimaryHotelImage: (hotelId: string, imageId: string) =>
    api.patch(`/catalog/hotels/${hotelId}/images/${imageId}/primary`, undefined, getAuthToken()),
  removeHotelImage: (hotelId: string, imageId: string) =>
    api.delete(`/catalog/hotels/${hotelId}/images/${imageId}`, getAuthToken()),
  createRoom: (hotelId: string, data: any) =>
    api.post<Room>(`/catalog/hotels/${hotelId}/rooms`, data, getAuthToken()),
  updateRoom: (roomId: string, data: any) =>
    api.patch<Room>(`/catalog/rooms/${roomId}`, data, getAuthToken()),
  deleteRoom: (roomId: string) => api.delete(`/catalog/rooms/${roomId}`, getAuthToken()),
  addRoomImages: (roomId: string, files: File[]) => {
    const form = new FormData()
    files.forEach((file) => form.append('images', file))
    return api.postForm(`/catalog/rooms/${roomId}/images`, form, getAuthToken())
  },
  setPrimaryRoomImage: (roomId: string, imageId: string) =>
    api.patch(`/catalog/rooms/${roomId}/images/${imageId}/primary`, undefined, getAuthToken()),
  removeRoomImage: (roomId: string, imageId: string) =>
    api.delete(`/catalog/rooms/${roomId}/images/${imageId}`, getAuthToken()),
  upsertSeasonalPricing: (roomId: string, data: any) =>
    api.post<SeasonalPricing>(`/catalog/rooms/${roomId}/seasonal-pricing`, data, getAuthToken()),
  deleteSeasonalPricing: (roomId: string, pricingId: string) =>
    api.delete(`/catalog/rooms/${roomId}/seasonal-pricing/${pricingId}`, getAuthToken()),
  setAvailability: (roomId: string, data: { dates: string[]; isAvailable: boolean; priceOverride?: number }) =>
    api.post(`/catalog/rooms/${roomId}/availability`, data, getAuthToken()),
  blockMaintenance: (data: { roomId: string; startDate: string; endDate: string; reason?: string }) =>
    api.post('/catalog/maintenance/block', data, getAuthToken()),
  bookings: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get<Paginated<Booking>>(`/bookings/manage${query(params)}`, getAuthToken()),
  stats: () =>
    api.get<{ pendingApprovals: number; todaysCheckIns: number; todaysCheckOuts: number; activeGuests: number }>(
      '/bookings/dashboard/stats',
      getAuthToken(),
    ),
  action: (id: string, action: 'confirm' | 'reject' | 'check-in' | 'check-out') =>
    api.post(`/bookings/${id}/${action}`, undefined, getAuthToken()),
  createWalkIn: (data: any) => api.post<Booking>('/bookings/walk-in', data, getAuthToken()),
  noShow: (bookingId: string) => api.post(`/bookings/${bookingId}/no-show`, undefined, getAuthToken()),
  earlyCheckIn: (bookingId: string, data: { actualCheckIn?: string; fee?: number; reason?: string }) =>
    api.post(`/bookings/${bookingId}/early-checkin`, data, getAuthToken()),
  lateCheckOut: (bookingId: string, data: { actualCheckOut?: string; fee?: number; reason?: string }) =>
    api.post(`/bookings/${bookingId}/late-checkout`, data, getAuthToken()),
  listStayRequests: (hotelId: string) =>
    api.get<StayRequest[]>(`/bookings/hotels/${hotelId}/stay-requests`, getAuthToken()),
  decideStayRequest: (stayRequestId: string, data: { decision: 'APPROVED' | 'REJECTED'; decisionNote?: string }) =>
    api.post(`/bookings/stay-requests/${stayRequestId}/decide`, data, getAuthToken()),
  relocateRoom: (bookingId: string, data: { oldRoomId: string; newRoomId: string; reason: string }) =>
    api.post(`/bookings/${bookingId}/relocate-room`, data, getAuthToken()),
  listStaff: (hotelId: string) =>
    api.get<{ data: HotelStaffMember[] }>(`/manager/hotels/${hotelId}/staff`, getAuthToken()),
  createStaff: (
    hotelId: string,
    data: { fullName: string; email: string; password: string; phone?: string; role?: string },
  ) => api.post(`/manager/hotels/${hotelId}/staff`, data, getAuthToken()),
  assignStaff: (
    hotelId: string,
    data: { email?: string; staffId?: string; userId?: string; role?: string },
  ) =>
    api.post(
      `/manager/hotels/${hotelId}/staff`,
      { staffId: data.staffId || data.userId, email: data.email, role: data.role },
      getAuthToken(),
    ),
  updateStaffRole: (hotelId: string, staffId: string, role: string) =>
    api.patch(`/manager/hotels/${hotelId}/staff/${staffId}/role`, { role }, getAuthToken()),
  updateStaffStatus: (hotelId: string, staffId: string, isActive: boolean) =>
    api.patch(`/manager/hotels/${hotelId}/staff/${staffId}/status`, { isActive }, getAuthToken()),
  removeStaff: (hotelId: string, staffId: string) =>
    api.delete(`/manager/hotels/${hotelId}/staff/${staffId}`, getAuthToken()),
  reportOverview: (hotelId: string) =>
    api.get<HotelReportOverview>(`/manager/hotels/${hotelId}/reports/overview`, getAuthToken()),
  reportOccupancy: (hotelId: string) =>
    api.get<any>(`/manager/hotels/${hotelId}/reports/occupancy`, getAuthToken()),
  reportRevenue: (hotelId: string, months = 6) =>
    api.get<MonthlyRevenueItem[]>(`/manager/hotels/${hotelId}/reports/monthly-revenue?months=${months}`, getAuthToken()),
  reportTrends: (hotelId: string, days = 30) =>
    api.get<DailyBookingTrendItem[]>(`/manager/hotels/${hotelId}/reports/booking-trends?days=${days}`, getAuthToken()),
  exportReportUrl: (hotelId: string, type: string, format: 'pdf' | 'excel', period = 'monthly') =>
    `${API_BASE_URL}/manager/hotels/${hotelId}/reports/${type}?format=${format}&period=${period}`,
  downloadReport: (
    hotelId: string,
    type: string,
    format: 'pdf' | 'excel',
    period = 'monthly',
    startDate?: string,
    endDate?: string,
  ) => {
    const params = new URLSearchParams({ format, period });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const url = `${API_BASE_URL}/manager/hotels/${hotelId}/reports/${type}?${params.toString()}`;
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    return downloadReportFile(url, `hotel-${hotelId}-${type}-${period}.${ext}`);
  },
  getOperationalRooms: (hotelId: string) =>
    api.get<OperationalRoom[]>(`/catalog/hotels/${hotelId}/rooms/operational`, getAuthToken()),
  updateRoomStatus: (roomId: string, status: 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE') =>
    api.patch<Room>(`/catalog/rooms/${roomId}/status`, { status }, getAuthToken()),
  listReviews: (hotelId: string, page = 1) =>
    api.get<ManagerReviewsResponse>(`/manager/hotels/${hotelId}/reviews${query({ page })}`, getAuthToken()),
  respondToReview: (hotelId: string, reviewId: string, response: string) =>
    api.post<Review>(`/manager/hotels/${hotelId}/reviews/${reviewId}/response`, { response }, getAuthToken()),
  deleteReviewResponse: (hotelId: string, reviewId: string) =>
    api.delete<Review>(`/manager/hotels/${hotelId}/reviews/${reviewId}/response`, getAuthToken()),
}


export const staffApi = {
  assignedHotels: () => api.get<Hotel[]>('/catalog/manager/hotels', getAuthToken()),
  operationalRooms: (hotelId: string) =>
    api.get<OperationalRoom[]>(`/catalog/hotels/${hotelId}/rooms/operational`, getAuthToken()),
  updateRoomStatus: (roomId: string, status: 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE') =>
    api.patch<Room>(`/catalog/rooms/${roomId}/status`, { status }, getAuthToken()),
}

export const adminApi = {
  overview: () =>
    api.get<{
      userCount: number
      hotelCount: number
      bookingCount: number
      totalRevenue: number
      users?: { total: number; customers: number; staff: number }
      hotels?: { total: number; active: number; pending: number }
      bookings?: { total: number; active: number; pending: number }
      revenue?: { total: number; thisMonth: number; pendingPayments: number }
      topHotels?: Array<{ id: string; name: string; starRating: number; revenue: number }>
    }>('/admin/reports/overview', getAuthToken()),
  occupancy: () =>
    api.get<{
      rooms: number
      occupiedRoomsToday: number
      totalRooms?: number
      occupiedToday?: number
      occupancyRate: number
      breakdown?: Array<{
        hotelId: string
        name: string
        totalRooms: number
        occupiedToday: number
        occupancyRate: number
      }>
    }>('/admin/reports/occupancy', getAuthToken()),
  monthlyRevenue: (months = 12) =>
    api.get<Array<{ month: string; revenue: number }>>(`/admin/reports/monthly-revenue?months=${months}`, getAuthToken()),
  bookingTrends: (days = 30) =>
    api.get<Array<{ date: string; bookings: number }>>(`/admin/reports/booking-trends?days=${days}`, getAuthToken()),
  mostBookedHotels: (limit = 10) =>
    api.get<Array<{ hotelId: string; name: string; bookings: number }>>(`/admin/reports/most-booked-hotels?limit=${limit}`, getAuthToken()),
  revenue: () =>
    api.get<Array<{ hotelId: string; name: string; revenue: number }>>('/admin/reports/revenue', getAuthToken()),
  exportReportUrl: (type: string, format: 'pdf' | 'excel', period = 'monthly') =>
    `${API_BASE_URL}/admin/reports/${type}?format=${format}&period=${period}`,
  downloadReport: (
    type: string,
    format: 'pdf' | 'excel',
    period = 'monthly',
    startDate?: string,
    endDate?: string,
  ) => {
    const params = new URLSearchParams({ format, period });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const url = `${API_BASE_URL}/admin/reports/${type}?${params.toString()}`;
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    return downloadReportFile(url, `admin-report-${type}-${period}.${ext}`);
  },
  users: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
    return api.get<{
      data: Array<User & { _count?: { bookings: number; reviews: number; favorites: number } }>
      total: number
      page: number
      pageSize: number
    }>(`/admin/users${qs}`, getAuthToken())
  },
  createUser: (data: {
    fullName: string
    email: string
    password: string
    phone?: string
    role?: 'CUSTOMER' | 'MANAGER' | 'STAFF' | 'ADMIN'
    hotelId?: string | null
  }) => api.post<User>('/admin/users', data, getAuthToken()),
  bookings: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
    return api.get<{ data: Booking[]; total: number; page: number; pageSize: number }>(
      `/admin/bookings${qs}`,
      getAuthToken(),
    )
  },
  hotels: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
    return api.get<{ data: Hotel[]; total: number; page: number; pageSize: number }>(
      `/admin/hotels${qs}`,
      getAuthToken(),
    )
  },
  payments: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
    return api.get<{ data: Payment[]; total: number; page: number; pageSize: number }>(
      `/admin/payments${qs}`,
      getAuthToken(),
    )
  },
  reviews: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
    return api.get<Paginated<Review>>(`/admin/reviews${qs}`, getAuthToken())
  },
  auditLogs: (params?: Record<string, string>) => {
    return api.get<any>(`/admin/audit-logs${query(params)}`, getAuthToken())
  },
  setUserActive: (userId: string, isActive: boolean) =>
    api.patch(`/admin/users/${userId}/active`, { isActive }, getAuthToken()),
  setHotelStatus: (hotelId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING' | 'REJECTED') =>
    api.patch(`/admin/hotels/${hotelId}/status`, { status }, getAuthToken()),
  approveHotel: (hotelId: string) => api.post(`/admin/hotels/${hotelId}/approve`, undefined, getAuthToken()),
  rejectHotel: (hotelId: string, reason: string) =>
    api.post(`/admin/hotels/${hotelId}/reject`, { reason }, getAuthToken()),
  createHotel: (data: any) => api.post<Hotel>('/catalog/hotels', data, getAuthToken()),
  addHotelImages: (hotelId: string, files: File[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('images', f))
    return api.postForm(`/catalog/hotels/${hotelId}/images`, form, getAuthToken())
  },
  reassignManager: (hotelId: string, managerId: string) =>
    api.patch(`/admin/hotels/${hotelId}/manager`, { managerId }, getAuthToken()),
  coupons: () => api.get<Coupon[]>('/admin/coupons', getAuthToken()),
  createCoupon: (data: any) => api.post<Coupon>('/admin/coupons', data, getAuthToken()),
  updateCoupon: (id: string, data: any) => api.patch<Coupon>(`/admin/coupons/${id}`, data, getAuthToken()),
  deleteCoupon: (id: string) => api.delete(`/admin/coupons/${id}`, getAuthToken()),
  settings: () => api.get<PlatformSetting[]>('/admin/settings', getAuthToken()),
  upsertSetting: (key: string, data: { value: any; description?: string }) =>
    api.put<PlatformSetting>(`/admin/settings/${key}`, data, getAuthToken()),
  deleteSetting: (key: string) => api.delete(`/admin/settings/${key}`, getAuthToken()),
}