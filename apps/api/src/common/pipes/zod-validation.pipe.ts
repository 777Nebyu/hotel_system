import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ZodValidationPipe<
  TInput,
  TOutput,
  TSchema extends z.ZodType<TOutput, any, TInput>,
> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
