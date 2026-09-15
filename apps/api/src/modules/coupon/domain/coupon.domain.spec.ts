import { applyCoupon } from './apply-coupon';

// ---------------------------------------------------------------------------
// Helpers — mirror how Prisma Decimal objects behave
// ---------------------------------------------------------------------------

/** Simulate a Prisma Decimal object — has .toNumber() instead of being a raw number. */
const decimal = (n: number) => ({ toNumber: () => n });

// ---------------------------------------------------------------------------
// applyCoupon — pure coupon discount function
// ---------------------------------------------------------------------------

describe('applyCoupon', () => {
  // ── PERCENTAGE discounts ───────────────────────────────────────────────
  describe('PERCENTAGE discount type', () => {
    it('applies 20% off $100 → discount $20, total $80', () => {
      const result = applyCoupon(100, { discountType: 'PERCENTAGE', value: 20 });
      expect(result.discount).toBe(20);
      expect(result.total).toBe(80);
    });

    it('applies 10% off $50 → discount $5, total $45', () => {
      const result = applyCoupon(50, { discountType: 'PERCENTAGE', value: 10 });
      expect(result.discount).toBe(5);
      expect(result.total).toBe(45);
    });

    it('applies 0% → no discount, total unchanged', () => {
      const result = applyCoupon(100, { discountType: 'PERCENTAGE', value: 0 });
      expect(result.discount).toBe(0);
      expect(result.total).toBe(100);
    });

    it('applies 100% → full discount, total is $0', () => {
      const result = applyCoupon(100, { discountType: 'PERCENTAGE', value: 100 });
      expect(result.discount).toBe(100);
      expect(result.total).toBe(0);
    });

    it('applies 50% off $315 (real booking total) → discount $157.5, total $157.5', () => {
      const result = applyCoupon(315, { discountType: 'PERCENTAGE', value: 50 });
      expect(result.discount).toBe(157.5);
      expect(result.total).toBe(157.5);
    });

    it('rounds percentage discount to 2 decimal places (33.33% of $10)', () => {
      const result = applyCoupon(10, { discountType: 'PERCENTAGE', value: 33.33 });
      // 10 * 33.33 / 100 = 3.333 → rounded to 3.33
      expect(result.discount).toBe(3.33);
      expect(result.total).toBe(6.67);
    });
  });

  // ── FIXED_AMOUNT discounts ────────────────────────────────────────────
  describe('FIXED_AMOUNT discount type', () => {
    it('applies fixed $15 off $50 → discount $15, total $35', () => {
      const result = applyCoupon(50, { discountType: 'FIXED_AMOUNT', value: 15 });
      expect(result.discount).toBe(15);
      expect(result.total).toBe(35);
    });

    it('applies fixed $0 off → no effect on total', () => {
      const result = applyCoupon(100, { discountType: 'FIXED_AMOUNT', value: 0 });
      expect(result.discount).toBe(0);
      expect(result.total).toBe(100);
    });

    it('applies fixed $100 off $100 exactly → total is $0', () => {
      const result = applyCoupon(100, { discountType: 'FIXED_AMOUNT', value: 100 });
      expect(result.discount).toBe(100);
      expect(result.total).toBe(0);
    });
  });

  // ── over-discount capping (FIXED_AMOUNT > total) ───────────────────────
  describe('over-discount capping', () => {
    it('caps fixed $60 off $50 at the total — discount $50, total $0', () => {
      const result = applyCoupon(50, { discountType: 'FIXED_AMOUNT', value: 60 });
      // Math.min(60, 50) = 50 → total = 50 - 50 = 0
      expect(result.discount).toBe(50);
      expect(result.total).toBe(0);
    });

    it('caps very large fixed discount — total never goes negative', () => {
      const result = applyCoupon(10, { discountType: 'FIXED_AMOUNT', value: 9999 });
      expect(result.discount).toBe(10);
      expect(result.total).toBe(0);
      // Critical: total is never negative
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('PERCENTAGE 100%+ is not capped — percentage of total cannot exceed total', () => {
      // 100% of 50 = 50, which equals total — this is fine
      const result = applyCoupon(50, { discountType: 'PERCENTAGE', value: 100 });
      expect(result.total).toBe(0);
      expect(result.discount).toBe(50);
    });
  });

  // ── Prisma Decimal value type ──────────────────────────────────────────
  describe('Prisma Decimal object as value', () => {
    it('accepts a Decimal object with .toNumber() for PERCENTAGE and returns correct result', () => {
      const result = applyCoupon(100, {
        discountType: 'PERCENTAGE',
        value: decimal(20),
      });
      expect(result.discount).toBe(20);
      expect(result.total).toBe(80);
    });

    it('accepts a Decimal object with .toNumber() for FIXED_AMOUNT and returns correct result', () => {
      const result = applyCoupon(50, {
        discountType: 'FIXED_AMOUNT',
        value: decimal(15),
      });
      expect(result.discount).toBe(15);
      expect(result.total).toBe(35);
    });

    it('accepts Decimal for over-discount and still caps correctly', () => {
      const result = applyCoupon(30, {
        discountType: 'FIXED_AMOUNT',
        value: decimal(999),
      });
      expect(result.discount).toBe(30);
      expect(result.total).toBe(0);
    });
  });

  // ── output shape ───────────────────────────────────────────────────────
  describe('output shape', () => {
    it('always returns an object with discount and total fields', () => {
      const result = applyCoupon(100, { discountType: 'PERCENTAGE', value: 10 });
      expect(result).toHaveProperty('discount');
      expect(result).toHaveProperty('total');
    });

    it('both discount and total are finite numbers', () => {
      const result = applyCoupon(200, { discountType: 'FIXED_AMOUNT', value: 50 });
      expect(Number.isFinite(result.discount)).toBe(true);
      expect(Number.isFinite(result.total)).toBe(true);
    });

    it('total is always >= 0', () => {
      const cases = [
        applyCoupon(100, { discountType: 'PERCENTAGE', value: 100 }),
        applyCoupon(50, { discountType: 'FIXED_AMOUNT', value: 9999 }),
        applyCoupon(0, { discountType: 'FIXED_AMOUNT', value: 10 }),
      ];
      for (const result of cases) {
        expect(result.total).toBeGreaterThanOrEqual(0);
      }
    });

    it('discount + total === original total (for PERCENTAGE within 100%)', () => {
      const original = 150;
      const result = applyCoupon(original, {
        discountType: 'PERCENTAGE',
        value: 30,
      });
      // 150 * 0.30 = 45 → roundCurrency(45) + roundCurrency(105) = 150
      expect(Math.round((result.discount + result.total) * 100) / 100).toBe(original);
    });
  });

  // ── edge cases with $0 totals ──────────────────────────────────────────
  describe('zero-total edge cases', () => {
    it('applying any PERCENTAGE to a $0 total yields $0 discount and $0 total', () => {
      const result = applyCoupon(0, { discountType: 'PERCENTAGE', value: 50 });
      expect(result.discount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('applying any FIXED_AMOUNT to a $0 total caps at $0 discount', () => {
      const result = applyCoupon(0, { discountType: 'FIXED_AMOUNT', value: 25 });
      // Math.min(25, 0) = 0
      expect(result.discount).toBe(0);
      expect(result.total).toBe(0);
    });
  });
});
