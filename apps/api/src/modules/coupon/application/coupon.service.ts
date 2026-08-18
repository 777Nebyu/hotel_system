import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type { Coupon } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateCouponInput, UpdateCouponInput } from '@repo/shared-types';

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CouponService {
  constructor(private readonly db: PrismaService) {}

  async list() {
    return this.db.coupon.findMany({ orderBy: { code: 'asc' } });
  }

  async create(dto: CreateCouponInput) {
    try {
      return await this.db.coupon.create({
        data: {
          code: dto.code,
          discountType: dto.discountType,
          value: dto.value,
          validFrom: dto.validFrom,
          validTo: dto.validTo,
          usageLimit: dto.usageLimit,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`Coupon code "${dto.code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCouponInput) {
    try {
      const coupon = await this.db.coupon.update({ where: { id }, data: dto });
      return coupon;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Coupon code already exists');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.db.coupon.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Coupon not found');
      }
      throw error;
    }
    return { deleted: true };
  }

  /** Validates that a code exists, is active and under its usage limit. */
  async validate(code: string, client: DbClient = this.db): Promise<Coupon> {
    const normalized = code.trim().toUpperCase();
    const coupon = await client.coupon.findUnique({
      where: { code: normalized },
    });
    if (!coupon) {
      throw new BadRequestException(`Invalid promo code "${normalized}"`);
    }
    const now = new Date();
    if (coupon.validFrom > now) {
      throw new BadRequestException('Promo code is not active yet');
    }
    if (coupon.validTo < now) {
      throw new BadRequestException('Promo code has expired');
    }
    if (coupon.timesUsed >= coupon.usageLimit) {
      throw new BadRequestException('Promo code usage limit reached');
    }
    return coupon;
  }

  /** Increments timesUsed. Call inside the booking creation transaction. */
  async claim(code: string, client: DbClient = this.db) {
    const normalized = code.trim().toUpperCase();
    return client.coupon.update({
      where: { code: normalized },
      data: { timesUsed: { increment: 1 } },
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
