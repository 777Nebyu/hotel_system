import { z } from 'zod'
import { registerSchema as baseRegisterSchema } from '@repo/shared-types'
export {
  loginSchema,
  forgotPasswordSchema,
  updateProfileSchema,
  bookingGuestSchema,
  reviewSchema,
  createCouponSchema,
  updateCouponSchema,
} from '@repo/shared-types'
export type {
  LoginInput,
  ForgotPasswordInput,
  UpdateProfileInput,
  ReviewInput,
  CreateCouponInput,
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
  guestEmail: z.string().email('Please enter a valid email address'),
  guestPhone: z.string().min(3, 'Phone number is required (min 3 characters)'),
})

export type GuestInfoInput = z.infer<typeof guestInfoSchema>
