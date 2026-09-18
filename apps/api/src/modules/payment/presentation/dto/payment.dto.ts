import { createZodDto } from 'nestjs-zod';
import {
  bookingIdParamsSchema,
  markCashPaidSchema,
  mockGatewayCallbackSchema,
  paymentMethodSchemaInput,
  verifyOtpSchema,
  bankCallbackSchema,
  chapaIntentSchema,
  chapaWebhookSchema,
} from '@repo/shared-types';

export class PaymentIdParamsDto extends createZodDto(bookingIdParamsSchema) {}
export class PaymentMethodDto extends createZodDto(paymentMethodSchemaInput) {}
export class MockCallbackDto extends createZodDto(mockGatewayCallbackSchema) {}
export class MarkCashPaidDto extends createZodDto(markCashPaidSchema) {}
export class VerifyOtpDto extends createZodDto(verifyOtpSchema) {}
export class BankCallbackDto extends createZodDto(bankCallbackSchema) {}
export class ChapaIntentDto extends createZodDto(chapaIntentSchema) {}
export class ChapaWebhookDto extends createZodDto(chapaWebhookSchema) {}
