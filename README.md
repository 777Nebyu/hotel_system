# YayeTech Hotel Booking System

A full-stack hotel booking platform with customer web, mobile, and admin surfaces sharing a single NestJS backend API.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Monorepo Structure](#monorepo-structure)
3. [Prerequisites](#prerequisites)
4. [Local Development Setup](#local-development-setup)
5. [Environment Variables](#environment-variables)
6. [Running Tests](#running-tests)
7. [API Documentation](#api-documentation)
8. [Deployment](#deployment)
9. [Authorization Matrix](#authorization-matrix)

---

## Tech Stack

| Layer | Technology |
|---|---|
| API Framework | NestJS 11 (Node.js) |
| Database | PostgreSQL (Neon serverless) |
| ORM | Prisma 7 |
| Auth | JWT — Access token (15 min) + Refresh token (7 days) |
| Queue | BullMQ + Redis (Upstash) |
| File Storage | Cloudinary (images) |
| Email | Nodemailer (SMTP) |
| Validation | Zod + nestjs-zod |
| API Docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| Logging | Winston + nest-winston |
| Rate Limiting | `@nestjs/throttler` |
| Web App | Next.js (customer + admin) |
| Mobile App | React Native + Expo |
| Monorepo | Turborepo + pnpm workspaces |
| Language | TypeScript 5 (strict) |

---

## Monorepo Structure

```
hotel_system/
├── apps/
│   ├── api/              # NestJS backend — all business logic lives here
│   │   ├── prisma/       # Schema, migrations, seed
│   │   └── src/
│   │       ├── modules/  # Feature modules (identity, catalog, booking, …)
│   │       ├── common/   # Guards, interceptors, pipes, cache, storage
│   │       └── config/   # Zod-validated environment configuration
│   ├── web/              # Next.js customer-facing and admin web app
│   └── mobile/           # React Native + Expo mobile app
└── packages/
    └── shared-types/     # Zod schemas + TypeScript types shared across all apps
```

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 20 | LTS recommended |
| pnpm | 9 | `npm i -g pnpm` |
| Docker Desktop | any | For local Redis container |
| Neon account | — | Free tier works: [neon.tech](https://neon.tech) |

---

## Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/777Nebyu/hotel_system.git
cd hotel_system

# 2. Install all dependencies (all workspaces)
pnpm install

# 3. Create your local environment file
cp apps/api/.env .env.local
# Then fill in the values — see the Environment Variables section below

# 4. Start local Redis
docker-compose up -d

# 5. Run database migrations
pnpm dlx prisma migrate dev

# 6. (Optional) Seed the database with sample data
pnpm --filter=api exec prisma db seed

# 7. Start all apps in development mode
pnpm dev
#   API  → http://localhost:3001
#   Web  → http://localhost:3000
```

---

## Environment Variables

Copy the values below into `apps/api/.env`. Variables marked **Required** will cause the app to refuse to start if missing.

| Variable | Description | Required | Default |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon or local) | ✅ Yes | — |
| `REDIS_URL` | Redis connection string (`redis://` or `rediss://` for TLS) | ✅ Yes | — |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens — minimum 32 characters | ✅ Yes | — |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens — minimum 32 characters | ✅ Yes | — |
| `JWT_ACCESS_TTL` | Access token lifetime (e.g. `15m`, `1h`) | No | `15m` |
| `JWT_REFRESH_TTL` | Refresh token lifetime (e.g. `7d`, `30d`) | No | `7d` |
| `MOCK_PAYMENT_WEBHOOK_SECRET` | Secret required by the development mock-payment callback | No | development fallback; replace in production |
| `PORT` | Port the API server listens on | No | `3001` |
| `NODE_ENV` | `development` \| `test` \| `production` | No | `development` |
| `WEB_ORIGIN` | Allowed CORS origin for the web app (e.g. `https://yourdomain.com`) | No | — |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name — required for image uploads | No | — |
| `CLOUDINARY_API_KEY` | Cloudinary API key | No | — |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | No | — |
| `EMAIL_HOST` | SMTP server host (e.g. `smtp.gmail.com`) | No | — |
| `EMAIL_PORT` | SMTP port (e.g. `587`) | No | — |
| `EMAIL_USER` | SMTP username | No | — |
| `EMAIL_PASS` | SMTP password or app password | No | — |
| `EMAIL_FROM` | Sender address (e.g. `noreply@yayetech.com`) | No | — |

> **Tip:** Without Cloudinary credentials the API starts normally but image uploads fall back to local disk storage. Without email credentials, notification jobs will silently no-op rather than crash.

---

## Running Tests

```bash
# Run all API unit tests
pnpm --filter=api exec jest --no-coverage

# Run a specific module's tests
pnpm --filter=api exec jest --testPathPatterns=booking.domain.spec

# Run tests with coverage report
pnpm --filter=api exec jest --coverage

# Run the PostgreSQL + Redis-backed booking/payment E2E suite
pnpm --filter=api test:e2e
```

The test suite covers:

| Module | What is tested |
|---|---|
| Booking domain | State machine (`canTransition`) + quote builder (`buildQuote`) |
| Catalog availability | `isAvailableOn`, `availableNights`, `roomAvailableAcross` |
| Payment gateways | All 5 adapters (approve/decline) + registry |
| Coupon domain | `applyCoupon` — percentage, fixed, over-discount cap, Decimal type |
| Identity service | Register, login, refresh, reset password, profile update |
| Lifecycle hardening | Logout invalidation, review HTML sanitization, callback secret/idempotency, refund authorization |

---

## API Documentation

Interactive Swagger UI is auto-generated from the code and available at:

| Environment | URL |
|---|---|
| Local dev | `http://localhost:3001/api/docs` |
| Staging (Render) | `https://<your-render-service>.onrender.com/api/docs` |

Raw OpenAPI JSON (for import into Postman or other tools):

```
GET /api/docs-json
```

A pre-generated Postman collection is also committed to the repository root:
[`postman_collection.json`](./postman_collection.json)

To regenerate it after API changes:
```bash
# API must be running locally on port 3001
pnpm run export:postman
```

---

## Deployment

| Service | Platform | Notes |
|---|---|---|
| API | [Render](https://render.com) | Web Service — Node.js, build: `pnpm build --filter=api`, start: `node apps/api/dist/src/main` |
| Web App | [Vercel](https://vercel.com) | Auto-deploys from `main` branch |
| Database | [Neon](https://neon.tech) | Serverless PostgreSQL — free tier supports the full app |
| Redis | [Upstash](https://upstash.com) | Serverless Redis — used for BullMQ jobs and search cache |
| Images | [Cloudinary](https://cloudinary.com) | Free tier for up to 25 GB storage |

---

## Authorization Matrix

| Endpoint group | Public | Customer | Staff | Manager | Admin |
|---|---|---|---|---|---|
| `POST /auth/register` | ✅ | — | — | — | — |
| `POST /auth/login` | ✅ | — | — | — | — |
| `POST /auth/refresh` | ✅ | — | — | — | — |
| `GET /hotels` (search) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /hotels/:id` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /bookings` | — | ✅ | — | — | — |
| `GET /bookings/me` | — | ✅ | — | — | — |
| `DELETE /bookings/:id` | — | ✅ (own) | — | — | ✅ |
| `GET /bookings/:id/invoice` | — | ✅ (own) | — | — | — |
| `POST /reviews` | — | ✅ | — | — | — |
| `GET /favorites` | — | ✅ | — | — | — |
| `GET /notifications` | — | ✅ | ✅ | ✅ | ✅ |
| `GET /manager/hotels` | — | — | — | ✅ | ✅ |
| `POST /manager/hotels` | — | — | — | ✅ | ✅ |
| `PATCH /manager/bookings/:id/status` | — | — | ✅ | ✅ | ✅ |
| `GET /admin/users` | — | — | — | — | ✅ |
| `GET /admin/dashboard/*` | — | — | — | — | ✅ |
| `GET /admin/reporting/export` | — | — | — | — | ✅ |
| `GET /admin/audit-log` | — | — | — | — | ✅ |
