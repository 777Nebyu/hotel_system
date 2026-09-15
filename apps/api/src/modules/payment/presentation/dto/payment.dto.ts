import { createZodDto } from 'nestjs-zod';
import {
  bookingIdParamsSchema,
  markCashPaidSchema,
  mockGatewayCallbackSchema,
  paymentMethodSchemaInput,
} from '@repo/shared-types';

export class PaymentIdParamsDto extends createZodDto(bookingIdParamsSchema) {}
export class PaymentMethodDto extends createZodDto(paymentMethodSchemaInput) {}
export class MockCallbackDto extends createZodDto(mockGatewayCallbackSchema) {}
export class MarkCashPaidDto extends createZodDto(markCashPaidSchema) {}
