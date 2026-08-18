import { createZodDto } from 'nestjs-zod';
import {
  bookingIdParamsSchema,
  mockGatewayCallbackSchema,
  paymentMethodSchemaInput,
} from '@repo/shared-types';

export class PaymentIdParamsDto extends createZodDto(bookingIdParamsSchema) {}
export class PaymentMethodDto extends createZodDto(paymentMethodSchemaInput) {}
export class MockCallbackDto extends createZodDto(mockGatewayCallbackSchema) {}
