import { createZodDto } from 'nestjs-zod';
import { hotelIdParamsSchema } from '@repo/shared-types';

export class HotelIdParamsDto extends createZodDto(hotelIdParamsSchema) {}
