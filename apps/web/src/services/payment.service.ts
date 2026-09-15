import { apiClient } from '@/lib/axios'
import type { Payment } from '@/lib/types'
import type { PaymentMethod } from '@repo/shared-types'

export interface PaymentIntentResult {
  paymentId: string
  bookingId: string
  amount: number
  status: string
  redirectUrl?: string
}

export const paymentService = {
  // Create or refresh payment intent with Idempotency Key
  createIntent: async (bookingId: string, method: PaymentMethod): Promise<PaymentIntentResult> => {
    const res = await apiClient.post<PaymentIntentResult>(`/payments/${bookingId}/intent`, { method })
    return res.data
  },

  // Get user payments
  getMyPayments: async (): Promise<{ data: Payment[] }> => {
    const res = await apiClient.get<{ data: Payment[] }>('/payments/my')
    return res.data
  },

  // Mock gateway completion callback for testing
  mockGatewayCallback: async (
    bookingId: string,
    data?: { reference?: string; transactionId?: string; message?: string },
    secret = 'development-mock-payment-secret',
  ): Promise<any> => {
    const res = await apiClient.post(`/payments/mock/${bookingId}`, data ?? {}, {
      headers: { 'x-mock-payment-secret': secret },
    })
    return res.data
  },

  mockCallback: async (
    bookingId: string,
    data?: { reference?: string; transactionId?: string; message?: string },
    secret = 'development-mock-payment-secret',
  ): Promise<any> => {
    const res = await apiClient.post(`/payments/mock/${bookingId}`, data ?? {}, {
      headers: { 'x-mock-payment-secret': secret },
    })
    return res.data
  },

  // Refund a booking payment
  refundPayment: async (bookingId: string): Promise<any> => {
    const res = await apiClient.post(`/payments/${bookingId}/refund`)
    return res.data
  },

  // Staff mark cash paid
  markCashPaid: async (bookingId: string, reference?: string): Promise<any> => {
    const res = await apiClient.post(`/payments/${bookingId}/cash-paid`, { reference })
    return res.data
  },
}
