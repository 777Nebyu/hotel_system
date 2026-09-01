DO $$ BEGIN
  CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'WALK_IN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "bookingRef"    TEXT,
  ADD COLUMN IF NOT EXISTS "bookingSource" "BookingSource" NOT NULL DEFAULT 'ONLINE';

UPDATE "Booking"
  SET "bookingRef" = CONCAT('YT-', EXTRACT(YEAR FROM "createdAt")::TEXT, '-', UPPER(SUBSTRING(id FROM 2 FOR 5)))
  WHERE "bookingRef" IS NULL;

ALTER TABLE "Booking"
  ALTER COLUMN "bookingRef" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookingRef_key" UNIQUE ("bookingRef");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Booking_bookingRef_idx" ON "Booking" ("bookingRef");

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "refundedAt"   TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PaymentAttempt" (
  "id"           TEXT         NOT NULL DEFAULT '',
  "paymentId"    TEXT         NOT NULL,
  "method"       TEXT         NOT NULL,
  "outcome"      TEXT         NOT NULL,
  "providerRef"  TEXT,
  "errorMessage" TEXT,
  "attemptedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAttempt_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PaymentAttempt_paymentId_idx"
  ON "PaymentAttempt" ("paymentId");
