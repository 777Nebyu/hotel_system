import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const monthsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(60).default(12),
});

export const daysQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const topHotelsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export class MonthsQueryDto extends createZodDto(monthsQuerySchema) {}
export class DaysQueryDto extends createZodDto(daysQuerySchema) {}
export class TopHotelsQueryDto extends createZodDto(topHotelsQuerySchema) {}
