import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paymentService } from '@/services/payment.service'
import type { PaymentMethod } from '@repo/shared-types'
import { useAuth } from '@/lib/auth-store'

export function useCreatePaymentIntentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ bookingId, method }: { bookingId: string; method: PaymentMethod }) =>
      paymentService.createIntent(bookingId, method),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', 'my'] })
    },
  })
}

export function useMyPaymentsQuery() {
  const user = useAuth((s) => s.user)

  return useQuery({
    queryKey: ['payments', 'my'],
    queryFn: () => paymentService.getMyPayments(),
    enabled: Boolean(user),
    staleTime: 1000 * 30, // 30s cache
  })
}

/**
 * Polls payment status for a specific booking until SUCCEEDED or FAILED,
 * especially useful for asynchronous flows like Telebirr and CBE Birr.
 */
export function usePaymentStatusPolling(bookingId: string | null, enabled = false) {
  const user = useAuth((s) => s.user)

  return useQuery({
    queryKey: ['payment-status', bookingId],
    queryFn: async () => {
      if (!bookingId) return null
      const res = await paymentService.getMyPayments()
      const match = res.data.find((p) => p.bookingId === bookingId)
      return match ?? null
    },
    enabled: Boolean(user && bookingId && enabled),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000
      if (data.status === 'SUCCEEDED' || data.status === 'FAILED' || data.status === 'REFUNDED') {
        return false // stop polling on terminal status
      }
      return 2000 // poll every 2 seconds while PENDING
    },
    staleTime: 0,
  })
}

export function useMockPaymentCallbackMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      bookingId,
      reference,
      transactionId,
      message,
    }: {
      bookingId: string
      reference?: string
      transactionId?: string
      message?: string
    }) =>
      paymentService.mockCallback(bookingId, { reference, transactionId, message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['hotel'] })
    },
  })
}

export function useRefundPaymentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (bookingId: string) => paymentService.refundPayment(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

export function useMarkCashPaidMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ bookingId, reference }: { bookingId: string; reference?: string }) =>
      paymentService.markCashPaid(bookingId, reference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}
