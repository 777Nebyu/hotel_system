import { Module } from '@nestjs/common';
import { CouponService } from './application/coupon.service';
import { CouponController } from './presentation/coupon.controller';

@Module({
  controllers: [CouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
