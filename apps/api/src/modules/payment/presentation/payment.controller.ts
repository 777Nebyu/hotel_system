import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentService } from '../application/payment.service';
import { Public } from '../../../common/decorators/public.decorator';
import {
  MockCallbackDto,
  PaymentIdParamsDto,
  PaymentMethodDto,
} from './dto/payment.dto';

interface AuthedRequest {
  user: { sub: string; role: string };
}

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the current user payment history' })
  myPayments(@Req() req: AuthedRequest) {
    return this.payments.myPayments(req.user.sub);
  }

  @Post(':bookingId/intent')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create (or refresh) a payment intent for a booking',
  })
  intent(
    @Param() params: PaymentIdParamsDto,
    @Body() dto: PaymentMethodDto,
    @Req() req: AuthedRequest,
  ) {
    return this.payments.createIntent(
      params.bookingId,
      dto.method,
      req.user.sub,
    );
  }

  @Post('mock/:bookingId')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Mock payment gateway callback' })
  mockCallback(
    @Param() params: PaymentIdParamsDto,
    @Body() body: MockCallbackDto,
  ) {
    return this.payments.mockCallback(params.bookingId, body);
  }
}
