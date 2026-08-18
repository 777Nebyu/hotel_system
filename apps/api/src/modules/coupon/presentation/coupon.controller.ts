import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../generated/prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CouponService } from '../application/coupon.service';
import {
  CouponIdParamsDto,
  CreateCouponDto,
  UpdateCouponDto,
} from './dto/coupon.dto';

@ApiTags('coupons')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/coupons')
export class CouponController {
  constructor(private readonly coupons: CouponService) {}

  @Get()
  @ApiOperation({ summary: 'List all discount coupons' })
  list() {
    return this.coupons.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a discount coupon' })
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a discount coupon' })
  update(@Param() params: CouponIdParamsDto, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(params.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a discount coupon' })
  remove(@Param() params: CouponIdParamsDto) {
    return this.coupons.remove(params.id);
  }
}
