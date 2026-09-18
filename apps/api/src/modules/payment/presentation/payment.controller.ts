import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentService } from '../application/payment.service';
import { Public } from '../../../common/decorators/public.decorator';
import {
  MockCallbackDto,
  MarkCashPaidDto,
  PaymentIdParamsDto,
  PaymentMethodDto,
  VerifyOtpDto,
  BankCallbackDto,
  ChapaIntentDto,
  ChapaWebhookDto,
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

  // ── Chapa Flow: Create Intent ───────────────────────────────────────────────

  @Post(':bookingId/chapa-intent')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Chapa payment intent with method-specific flow' })
  chapaIntent(
    @Param('bookingId') bookingId: string,
    @Body() dto: ChapaIntentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.payments.createChapaIntent(
      bookingId,
      dto.method,
      req.user.sub,
      {
        phone: dto.phone,
        email: dto.email,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
      },
    );
  }

  // ── Chapa Flow: Verify OTP ──────────────────────────────────────────────────

  @Post(':paymentId/verify-otp')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify OTP for Telebirr payment' })
  verifyOtp(
    @Param('paymentId') paymentId: string,
    @Body() dto: VerifyOtpDto,
    @Req() req: AuthedRequest,
  ) {
    return this.payments.verifyOtp(paymentId, dto.code);
  }

  // ── Chapa Flow: Bank Callback ───────────────────────────────────────────────

  @Post(':paymentId/bank-callback')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Handle bank authorization callback' })
  bankCallback(
    @Param('paymentId') paymentId: string,
    @Body() dto: BankCallbackDto,
    @Req() req: AuthedRequest,
  ) {
    return this.payments.handleBankCallback(paymentId, dto);
  }

  // ── Chapa Flow: Get Payment Status ──────────────────────────────────────────

  @Get(':paymentId/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status for polling' })
  getPaymentStatus(@Param('paymentId') paymentId: string) {
    return this.payments.getPaymentStatus(paymentId);
  }

  // ── Chapa Flow: Cancel Payment ──────────────────────────────────────────────

  @Post(':paymentId/cancel')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a pending/processing payment' })
  cancelPayment(
    @Param('paymentId') paymentId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.payments.cancelPayment(paymentId, req.user.sub);
  }

  // ── Chapa Flow: Webhook ─────────────────────────────────────────────────────

  @Post('webhook/chapa')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiOperation({ summary: 'Chapa webhook — server-side payment verification' })
  chapaWebhook(@Body() body: ChapaWebhookDto) {
    return this.payments.handleWebhook(body.tx_ref, {
      status: body.status,
      amount: body.amount,
      currency: body.currency,
    });
  }

  // ── Callback (user-facing redirect) ─────────────────────────────────────────

  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'Payment callback — user-facing redirect after payment' })
  callback(
    @Query('tx_ref') txRef: string,
    @Query('status') status: string,
  ) {
    return { txRef, status, message: 'Payment processed' };
  }

  // ── Legacy Mock Callback ────────────────────────────────────────────────────

  @Post('mock/:bookingId')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Mock payment gateway callback (legacy)' })
  mockCallback(
    @Param() params: PaymentIdParamsDto,
    @Body() body: MockCallbackDto,
    @Headers('x-mock-payment-secret') webhookSecret: string | undefined,
  ) {
    return this.payments.mockCallback(params.bookingId, body, webhookSecret);
  }

  // ── Refund ──────────────────────────────────────────────────────────────────

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

  // ── Cash Paid ───────────────────────────────────────────────────────────────

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
