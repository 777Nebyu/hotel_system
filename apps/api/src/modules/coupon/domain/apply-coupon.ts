import { roundCurrency } from '../../catalog/domain/pricing';

export interface CouponLike {
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: { toNumber(): number } | number;
}

export interface CouponResult {
  discount: number;
  total: number;
}

export function applyCoupon(total: number, coupon: CouponLike): CouponResult {
  const value =
    typeof coupon.value === 'number' ? coupon.value : coupon.value.toNumber();
  const discount =
    coupon.discountType === 'PERCENTAGE'
      ? (total * value) / 100
      : Math.min(value, total);
  return {
    discount: roundCurrency(discount),
    total: roundCurrency(total - discount),
  };
}
