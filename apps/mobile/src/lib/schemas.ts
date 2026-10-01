import { z } from 'zod'
import {
  registerSchema as baseRegisterSchema,
  emailFieldSchema,
} from '@repo/shared-types'
export {
  loginSchema,
  forgotPasswordSchema,
  updateProfileSchema,
  bookingGuestSchema,
  reviewSchema,
  createCouponSchema,
  updateCouponSchema,
  emailFieldSchema,
  resendVerificationSchema,
} from '@repo/shared-types'
export type {
  LoginInput,
  ForgotPasswordInput,
  UpdateProfileInput,
  ReviewInput,
  CreateCouponInput,
  ResendVerificationInput,
} from '@repo/shared-types'

export const registerSchema = baseRegisterSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterInput = z.infer<typeof registerSchema>

export const guestInfoSchema = z.object({
  guestFullName: z.string().min(2, 'Guest name is required (min 2 characters)'),
  guestEmail: emailFieldSchema,
  guestPhone: z.string().min(3, 'Phone number is required (min 3 characters)'),
})

export type GuestInfoInput = z.infer<typeof guestInfoSchema>
