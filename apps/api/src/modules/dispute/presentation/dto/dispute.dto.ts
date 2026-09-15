import { createZodDto } from 'nestjs-zod';
import {
  createDisputeSchema,
  disputeIdParamsSchema,
  disputeQuerySchema,
  resolveDisputeSchema,
} from '@repo/shared-types';

export class CreateDisputeDto extends createZodDto(createDisputeSchema) {}
export class ResolveDisputeDto extends createZodDto(resolveDisputeSchema) {}
export class DisputeIdParamsDto extends createZodDto(disputeIdParamsSchema) {}
export class DisputeQueryDto extends createZodDto(disputeQuerySchema) {}
