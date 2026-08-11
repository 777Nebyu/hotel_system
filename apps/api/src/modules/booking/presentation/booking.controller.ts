import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('bookings')
@Controller('bookings')
export class BookingController {}
