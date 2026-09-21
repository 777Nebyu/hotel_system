import { apiClient, API_BASE_URL } from '@/lib/axios'
import type { Booking, BookingQuote, BookingsResponse, RoomHold } from '@/lib/types'
import type { CheckoutInput, CreateBookingInput } from '@repo/shared-types'

export const bookingService = {
  // Authoritative price calculation preview (Section 1.1)
  getCheckoutQuote: async (input: CheckoutInput): Promise<BookingQuote> => {
    const res = await apiClient.post<BookingQuote>('/bookings/checkout', input)
    return res.data
  },

  // Atomic booking creation mutation (Section 2.A)
  createBooking: async (input: CreateBookingInput): Promise<Booking> => {
    const res = await apiClient.post<Booking>('/bookings', input)
    return res.data
  },

  // List customer bookings
  getMyBookings: async (scope?: 'upcoming' | 'past'): Promise<BookingsResponse> => {
    const qs = scope ? `?scope=${scope}` : ''
    const res = await apiClient.get<BookingsResponse>(`/bookings/my${qs}`)
    return res.data
  },

  // Cancel booking
  cancelBooking: async (bookingId: string): Promise<Booking> => {
    const res = await apiClient.post<Booking>(`/bookings/${bookingId}/cancel`)
    return res.data
  },

  // 15-minute temporary room hold
  createHold: async (data: { roomId: string; checkIn: string; checkOut: string }): Promise<RoomHold> => {
    const res = await apiClient.post<RoomHold>('/bookings/holds', data)
    return res.data
  },

  // Release temporary room hold
  releaseHold: async (holdId: string): Promise<void> => {
    await apiClient.delete(`/bookings/holds/${holdId}`)
  },

  // Request early check-in or late check-out
  createStayRequest: async (
    bookingId: string,
    data: { type: 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT'; requestedTime: string },
  ): Promise<any> => {
    const res = await apiClient.post(`/bookings/${bookingId}/stay-requests`, data)
    return res.data
  },

  // Modify dates of a confirmed booking
  modifyBooking: async (
    bookingId: string,
    data: { checkIn: string; checkOut: string; reason?: string },
  ): Promise<any> => {
    const res = await apiClient.post(`/bookings/${bookingId}/modify`, data)
    return res.data
  },

  // Download invoice PDF securely via authenticated blob request
  downloadInvoice: async (bookingId: string, filename?: string): Promise<void> => {
    const res = await apiClient.get(`/bookings/${bookingId}/invoice`, {
      responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `invoice-${bookingId}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  // Get invoice PDF url (appends token query param for direct browser navigation)
  getInvoiceDownloadUrl: (bookingId: string, token?: string): string => {
    let resolvedToken = token
    if (!resolvedToken && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('yayetech.session') || localStorage.getItem('luxstay.session')
        if (raw) {
          const parsed = JSON.parse(raw)
          resolvedToken = parsed.accessToken
        }
      } catch {
        // ignore
      }
    }
    const query = resolvedToken ? `?token=${encodeURIComponent(resolvedToken)}` : ''
    return `${API_BASE_URL}/bookings/${bookingId}/invoice${query}`
  },
}
