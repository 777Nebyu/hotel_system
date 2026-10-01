import { emailFieldSchema, guestInfoSchema, registerSchema } from '../lib/schemas'
import {
  bookingGuestSchema,
  chapaIntentSchema,
  createWalkInBookingSchema,
} from '@repo/shared-types'

describe('emailFieldSchema', () => {
  it.each([
    ['empty string', ''],
    ['missing @', 'john@'],
    ['missing domain', 'john.com'],
    ['single-char TLD', 'a@b.c'],
    ['leading dot in local part', '.john@x.com'],
    ['trailing dot in local part', 'john.@x.com'],
    ['consecutive dots in local part', 'john..doe@x.com'],
    ['consecutive dots in domain', 'john@x..com'],
    ['whitespace inside', 'john doe@example.com'],
    ['no TLD', 'john@example'],
    ['numeric TLD', 'john@example.c0m'],
    ['over 254 characters', `${'a'.repeat(250)}@example.com`],
  ])('rejects %s', (_label, value) => {
    expect(emailFieldSchema.safeParse(value).success).toBe(false)
  })

  it.each([
    'john.doe@example.com',
    'user+tag@sub.example.co',
    'a@b.io',
    'FIRST.LAST@EXAMPLE.COM',
  ])('accepts %s', (value) => {
    expect(emailFieldSchema.safeParse(value).success).toBe(true)
  })

  it('trims surrounding whitespace before validating', () => {
    expect(emailFieldSchema.parse('  john@example.com ')).toBe('john@example.com')
  })

  it('reports a required error for a blank email', () => {
    const result = emailFieldSchema.safeParse('   ')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Email address is required')
    }
  })
})

describe('guestInfoSchema', () => {
  const validGuest = {
    guestFullName: 'Jane Doe',
    guestEmail: 'jane@example.com',
    guestPhone: '+251911111111',
  }

  it('accepts valid guest details', () => {
    expect(guestInfoSchema.safeParse(validGuest).success).toBe(true)
  })

  it('rejects a malformed guest email', () => {
    const result = guestInfoSchema.safeParse({ ...validGuest, guestEmail: 'jane@' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'guestEmail')).toBe(true)
    }
  })
})

describe('registerSchema email field', () => {
  const base = {
    password: 'Sup3rSecret!',
    confirmPassword: 'Sup3rSecret!',
    fullName: 'Test User',
  }

  it('rejects a malformed email on the shared register payload', () => {
    expect(registerSchema.safeParse({ ...base, email: 'user@' }).success).toBe(false)
  })

  it('accepts a well formed email on the shared register payload', () => {
    expect(registerSchema.safeParse({ ...base, email: 'user@example.com' }).success).toBe(true)
  })
})

const INVALID_EMAILS = [
  'john@',
  'a@b.c',
  '.john@x.com',
  'john..doe@x.com',
  'john@x..com',
  'john@example',
] as const

describe('booking/payment schemas use the strict shared email check', () => {
  it.each(INVALID_EMAILS)('bookingGuestSchema rejects %s', (email) => {
    const result = bookingGuestSchema.safeParse({ fullName: 'Jane Doe', email })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'email')).toBe(true)
    }
  })

  it('bookingGuestSchema accepts a well formed email', () => {
    expect(
      bookingGuestSchema.safeParse({ fullName: 'Jane Doe', email: 'jane@example.com' }).success,
    ).toBe(true)
  })

  it.each(INVALID_EMAILS)('createWalkInBookingSchema rejects guestEmail %s', (guestEmail) => {
    const result = createWalkInBookingSchema.safeParse({
      hotelId: 'hotel-1',
      roomIds: ['room-1'],
      checkIn: '2026-09-10',
      checkOut: '2026-09-12',
      guestName: 'Jane Doe',
      guestPhone: '+251911223344',
      guestEmail,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'guestEmail')).toBe(true)
    }
  })

  it('createWalkInBookingSchema still accepts an omitted guestEmail (synthetic walk-in)', () => {
    expect(
      createWalkInBookingSchema.safeParse({
        hotelId: 'hotel-1',
        roomIds: ['room-1'],
        checkIn: '2026-09-10',
        checkOut: '2026-09-12',
        guestName: 'Jane Doe',
        guestPhone: '+251911223344',
      }).success,
    ).toBe(true)
  })

  it.each(INVALID_EMAILS)('chapaIntentSchema rejects email %s', (email) => {
    expect(chapaIntentSchema.safeParse({ method: 'CREDIT_CARD', email }).success).toBe(false)
  })

  it('chapaIntentSchema accepts a well formed email and still allows it to be omitted', () => {
    expect(chapaIntentSchema.safeParse({ method: 'CREDIT_CARD', email: 'a@b.co' }).success).toBe(true)
    expect(chapaIntentSchema.safeParse({ method: 'CREDIT_CARD' }).success).toBe(true)
  })
})
