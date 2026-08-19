import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const WEBHOOK_SECRET = process.env.MOCK_PAYMENT_WEBHOOK_SECRET ?? 'development-mock-payment-secret';

describe('Booking-payment lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let db: PrismaService;
  let hotelId: string;
  let roomId: string;
  let userId: string;
  let bookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(PrismaService);

    const suffix = Date.now().toString();
    const country = await db.country.create({
      data: { name: `E2E Country ${suffix}`, code: `E${suffix.slice(-2)}` },
    });
    const city = await db.city.create({
      data: { name: `E2E City ${suffix}`, countryId: country.id },
    });
    const hotel = await db.hotel.create({
      data: {
        name: `E2E Hotel ${suffix}`,
        description: 'Lifecycle test hotel',
        address: 'E2E address',
        cityId: city.id,
        status: 'ACTIVE',
      },
    });
    const room = await db.room.create({
      data: {
        hotelId: hotel.id,
        roomNumber: `E2E-${suffix}`,
        type: 'STANDARD',
        capacity: 2,
        basePrice: 100,
      },
    });
    hotelId = hotel.id;
    roomId = room.id;
  });

  afterAll(async () => {
    if (bookingId) await db.booking.delete({ where: { id: bookingId } }).catch(() => undefined);
    if (roomId) await db.room.delete({ where: { id: roomId } }).catch(() => undefined);
    if (hotelId) {
      const hotel = await db.hotel.findUnique({ where: { id: hotelId }, select: { cityId: true } });
      await db.hotel.delete({ where: { id: hotelId } }).catch(() => undefined);
      if (hotel) {
        const city = await db.city.findUnique({ where: { id: hotel.cityId }, select: { countryId: true } });
        await db.city.delete({ where: { id: hotel.cityId } }).catch(() => undefined);
        if (city) await db.country.delete({ where: { id: city.countryId } }).catch(() => undefined);
      }
    }
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    await app.close();
  });

  it('completes booking, payment, idempotent callback, refund, logout, and sanitized review', async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123', fullName: 'E2E Guest' })
      .expect(201);
    userId = register.body.user.id;
    const accessToken = register.body.accessToken as string;
    const refreshToken = register.body.refreshToken as string;

    await request(app.getHttpServer())
      .post('/bookings/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ hotelId, roomIds: [roomId], checkIn: '2099-01-01', checkOut: '2099-01-03' })
      .expect(201);

    const booking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        hotelId,
        roomIds: [roomId],
        checkIn: '2099-01-01',
        checkOut: '2099-01-03',
        guestInfos: [{ fullName: 'E2E Guest' }],
      })
      .expect(201);
    bookingId = booking.body.id;

    await request(app.getHttpServer())
      .post(`/payments/${bookingId}/intent`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ method: 'CREDIT_CARD' })
      .expect(201);

    const callback = () =>
      request(app.getHttpServer())
        .post(`/payments/mock/${bookingId}`)
        .set('x-mock-payment-secret', WEBHOOK_SECRET)
        .send({ reference: '4242424242424242' });
    await callback().expect(201);
    const replay = await callback().expect(201);
    expect(replay.body.idempotent).toBe(true);

    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const refundReplay = await request(app.getHttpServer())
      .post(`/payments/${bookingId}/refund`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    expect(refundReplay.body.idempotent).toBe(true);

    await db.booking.update({ where: { id: bookingId }, data: { status: 'CHECKED_OUT' } });
    const review = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ hotelId, bookingId, rating: 5, comment: '<script>alert(1)</script><b>Great stay</b>' })
      .expect(201);
    expect(review.body.comment).toBe('Great stay');

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(401);
  });
});
