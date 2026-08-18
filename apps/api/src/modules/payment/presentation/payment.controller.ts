import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

  @Post(':bookingId/intent')
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
  @ApiOperation({ summary: 'Mock payment gateway callback' })
  mockCallback(
    @Param() params: PaymentIdParamsDto,
    @Body() body: MockCallbackDto,
  ) {
    return this.payments.mockCallback(params.bookingId, body);
  }
}
