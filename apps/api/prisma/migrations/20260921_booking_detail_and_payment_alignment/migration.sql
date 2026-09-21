-- 1. PaymentStatus enum values
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'OTP_SENT';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'TIMEOUT';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PENDING_AT_HOTEL';


-- 2. BookingDetail checkIn and checkOut
ALTER TABLE "BookingDetail" ADD COLUMN IF NOT EXISTS "checkIn" DATE;
ALTER TABLE "BookingDetail" ADD COLUMN IF NOT EXISTS "checkOut" DATE;

UPDATE "BookingDetail" bd
SET "checkIn" = b."checkIn",
    "checkOut" = b."checkOut"
FROM "Booking" b
WHERE bd."bookingId" = b."id"
  AND (bd."checkIn" IS NULL OR bd."checkOut" IS NULL);

UPDATE "BookingDetail"
SET "checkIn" = CURRENT_DATE,
    "checkOut" = CURRENT_DATE + INTERVAL '1 day'
WHERE "checkIn" IS NULL OR "checkOut" IS NULL;

ALTER TABLE "BookingDetail" ALTER COLUMN "checkIn" SET NOT NULL;
ALTER TABLE "BookingDetail" ALTER COLUMN "checkOut" SET NOT NULL;

-- 3. BookingStatusHistory fromStatus, toStatus, actorId
ALTER TABLE "BookingStatusHistory" ADD COLUMN IF NOT EXISTS "fromStatus" "BookingStatus";
ALTER TABLE "BookingStatusHistory" ADD COLUMN IF NOT EXISTS "toStatus" "BookingStatus";
ALTER TABLE "BookingStatusHistory" ADD COLUMN IF NOT EXISTS "actorId" TEXT;

UPDATE "BookingStatusHistory"
SET "fromStatus" = 'PENDING',
    "toStatus" = COALESCE(
      CASE 
        WHEN "status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'REJECTED', 'NO_SHOW')
        THEN "status"::"BookingStatus"
        ELSE 'CONFIRMED'::"BookingStatus"
      END,
      'CONFIRMED'::"BookingStatus"
    )
WHERE "fromStatus" IS NULL OR "toStatus" IS NULL;

ALTER TABLE "BookingStatusHistory" ALTER COLUMN "fromStatus" SET NOT NULL;
ALTER TABLE "BookingStatusHistory" ALTER COLUMN "toStatus" SET NOT NULL;
ALTER TABLE "BookingStatusHistory" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "BookingStatusHistory" ALTER COLUMN "changedBy" DROP NOT NULL;


-- 4. Payment table columns
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'CHAPA';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'ETB';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "txRef" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "checkoutSessionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "bankCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "transactionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "verificationCodeHash" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "verificationExpiresAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "verificationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_txRef_key" ON "Payment"("txRef");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "Payment_txRef_idx" ON "Payment"("txRef");
CREATE INDEX IF NOT EXISTS "Payment_idempotencyKey_idx" ON "Payment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt" DESC);

-- 5. PaymentEvent table
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");
CREATE INDEX IF NOT EXISTS "PaymentEvent_eventType_idx" ON "PaymentEvent"("eventType");
CREATE INDEX IF NOT EXISTS "PaymentEvent_createdAt_idx" ON "PaymentEvent"("createdAt" DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PaymentEvent_paymentId_fkey'
    ) THEN
        ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" 
        FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 6. PaymentAttempt table columns
ALTER TABLE "PaymentAttempt" ALTER COLUMN "paymentId" DROP NOT NULL;
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "bookingId" TEXT;
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'INITIATED';
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "error" TEXT;
ALTER TABLE "PaymentAttempt" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "PaymentAttempt" pa
SET "bookingId" = p."bookingId"
FROM "Payment" p
WHERE pa."paymentId" = p."id" AND pa."bookingId" IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAttempt_bookingId_fkey'
    ) THEN
        ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_bookingId_fkey" 
        FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PaymentAttempt_bookingId_idx" ON "PaymentAttempt"("bookingId");
