import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { configuration } from './config/configuration';
import { createLoggerOptions } from './common/logging/winston.config';
import { requestIdMiddleware } from './common/logging/request-id.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { HealthModule } from './health/health.module';
import { EventsModule } from './modules/events/events.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { BookingModule } from './modules/booking/booking.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReviewModule } from './modules/review/review.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminReportingModule } from './modules/admin-reporting/admin-reporting.module';
import { AdminModule } from './modules/admin/admin.module';
import { FavoriteModule } from './modules/favorite/favorite.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: process.env.NODE_ENV === 'test' ? 100_000 : 100,
      },
    ]),
    WinstonModule.forRoot(
      createLoggerOptions(process.env.NODE_ENV ?? 'development'),
    ),
    PrismaModule,
    StorageModule,
    HealthModule,
    EventsModule,
    IdentityModule,
    CatalogModule,
    BookingModule,
    PaymentModule,
    ReviewModule,
    FavoriteModule,
    NotificationModule,
    AdminReportingModule,
    AdminModule,
    CouponModule,
    InvoiceModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}
