import { Module } from '@nestjs/common';
import { BookingController } from './presentation/booking.controller';
import { BookingService } from './application/booking.service';

@Module({ controllers: [BookingController], providers: [BookingService] })
export class BookingModule {}
