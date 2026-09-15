import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bookingService } from '@/services/booking.service'
import type { CheckoutInput, CreateBookingInput } from '@repo/shared-types'
import { useAuth } from '@/lib/auth-store'

export function useCheckoutQuoteQuery(input: CheckoutInput | null, enabled = true) {
  return useQuery({
    queryKey: ['checkout-quote', input?.hotelId, input?.roomIds, input?.checkIn, input?.checkOut, input?.promoCode],
    queryFn: () => bookingService.getCheckoutQuote(input!),
    enabled: Boolean(enabled && input && input.hotelId && input.roomIds?.length > 0 && input.checkIn && input.checkOut),
    staleTime: 1000 * 30, // 30s cache for quotes
  })
}

export function useCreateBookingMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateBookingInput) => bookingService.createBooking(input),
    onSuccess: () => {
      // Invalidate live availability and bookings list immediately
      queryClient.invalidateQueries({ queryKey: ['hotel'] })
      queryClient.invalidateQueries({ queryKey: ['bookings', 'my'] })
    },
  })
}

export function useMyBookingsQuery(scope?: 'upcoming' | 'past') {
  const user = useAuth((s) => s.user)

  return useQuery({
    queryKey: ['bookings', 'my', scope],
    queryFn: () => bookingService.getMyBookings(scope),
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 2,
  })
}

export function useCancelBookingMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (bookingId: string) => bookingService.cancelBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['hotel'] })
    },
  })
}

export function useCreateHoldMutation() {
  return useMutation({
    mutationFn: (data: { roomId: string; checkIn: string; checkOut: string }) =>
      bookingService.createHold(data),
  })
}

export function useReleaseHoldMutation() {
  return useMutation({
    mutationFn: (holdId: string) => bookingService.releaseHold(holdId),
  })
}

export function useCreateStayRequestMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      bookingId,
      type,
      requestedTime,
    }: {
      bookingId: string
      type: 'EARLY_CHECK_IN' | 'LATE_CHECK_OUT'
      requestedTime: string
    }) => bookingService.createStayRequest(bookingId, { type, requestedTime }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'my'] })
    },
  })
}

export function useModifyBookingMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      bookingId,
      checkIn,
      checkOut,
      reason,
    }: {
      bookingId: string
      checkIn: string
      checkOut: string
      reason?: string
    }) => bookingService.modifyBooking(bookingId, { checkIn, checkOut, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['hotel'] })
    },
  })
}

