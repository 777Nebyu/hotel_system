import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentService } from '../application/payment.service';
import { Public } from '../../../common/decorators/public.decorator';
import {
  MockCallbackDto,
  MarkCashPaidDto,
  PaymentIdParamsDto,
  PaymentMethodDto,
} from './dto/payment.dto';


interface AuthedRequest {
  user: { sub: string; role: string; hotelId?: string };
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
    @Headers('x-mock-payment-secret') webhookSecret: string | undefined,
  ) {
    return this.payments.mockCallback(params.bookingId, body, webhookSecret);
  }

  @Post(':bookingId/refund')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund a successful booking payment' })
  refund(
    @Param() params: PaymentIdParamsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.payments.refund(params.bookingId, req.user);
  }

  @Post(':bookingId/cash-paid')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Staff/Manager: mark a CASH booking payment as received on-site',
  })
  markCashPaid(
    @Param() params: PaymentIdParamsDto,
    @Body() body: MarkCashPaidDto,
    @Req() req: AuthedRequest,
  ) {
    return this.payments.markCashPaid(params.bookingId, body, req.user);
  }
}
