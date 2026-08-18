import { Module } from '@nestjs/common';
import { PaymentGatewayRegistry } from './infrastructure/gateway-registry';
import {
  CashGateway,
  CbeBirrGateway,
  CreditCardGateway,
  PayPalGateway,
  TelebirrGateway,
} from './infrastructure/gateways';
import { PaymentController } from './presentation/payment.controller';
import { PaymentService } from './application/payment.service';

@Module({
  controllers: [PaymentController],
  providers: [
    PaymentService,
    CreditCardGateway,
    PayPalGateway,
    TelebirrGateway,
    CbeBirrGateway,
    CashGateway,
    {
      provide: PaymentGatewayRegistry,
      useFactory: (
        creditCard: CreditCardGateway,
        paypal: PayPalGateway,
        telebirr: TelebirrGateway,
        cbeBirr: CbeBirrGateway,
        cash: CashGateway,
      ) =>
        new PaymentGatewayRegistry([
          creditCard,
          paypal,
          telebirr,
          cbeBirr,
          cash,
        ]),
      inject: [
        CreditCardGateway,
        PayPalGateway,
        TelebirrGateway,
        CbeBirrGateway,
        CashGateway,
      ],
    },
  ],
})
export class PaymentModule {}
