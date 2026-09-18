import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { PaymentGatewayRegistry } from './infrastructure/gateway-registry';
import {
  CashGateway,
  CbeBirrGateway,
  CreditCardGateway,
  PayPalGateway,
  TelebirrGateway,
  ChapaMockProvider,
  BankMockProvider,
  MockSmsService,
} from './infrastructure/gateways';
import { OtpService } from './application/otp.service';
import { PaymentController } from './presentation/payment.controller';
import { MockSmsController } from './presentation/mock-sms.controller';
import { AdminSandboxController } from './presentation/admin-sandbox.controller';
import { PaymentService } from './application/payment.service';
import { FraudModule } from '../fraud/fraud.module';

@Module({
  imports: [FraudModule],
  controllers: [
    PaymentController,
    MockSmsController,
    AdminSandboxController,
  ],
  providers: [
    PaymentService,
    AuditService,
    OtpService,
    MockSmsService,
    CreditCardGateway,
    PayPalGateway,
    TelebirrGateway,
    CbeBirrGateway,
    CashGateway,
    BankMockProvider,
    ChapaMockProvider,
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
  exports: [
    PaymentService,
    OtpService,
    MockSmsService,
    ChapaMockProvider,
    BankMockProvider,
    PaymentGatewayRegistry,
  ],
})
export class PaymentModule {}
