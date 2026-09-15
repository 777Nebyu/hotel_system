DO $$ BEGIN
  CREATE TYPE "HotelStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Hotel"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Hotel"
  ALTER COLUMN "status" TYPE "HotelStatus" USING ("status"::text::"HotelStatus"),
  ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

ALTER TABLE "Hotel"
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "pushToken" TEXT;

CREATE TABLE IF NOT EXISTS "HotelPolicy" (
  "id"                     TEXT          NOT NULL,
  "hotelId"                TEXT          NOT NULL,
  "checkInTime"            TEXT          NOT NULL DEFAULT '14:00',
  "checkOutTime"           TEXT          NOT NULL DEFAULT '11:00',
  "cancellationWindowDays" INTEGER       NOT NULL DEFAULT 3,
  "cancellationFeePercent" DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  "allowEarlyCheckIn"      BOOLEAN       NOT NULL DEFAULT true,
  "earlyCheckInFee"        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "allowLateCheckOut"      BOOLEAN       NOT NULL DEFAULT true,
  "lateCheckOutFee"        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "createdAt"              TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "HotelPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelPolicy_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "HotelPolicy_hotelId_key" ON "HotelPolicy" ("hotelId");

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "type"      TEXT         NOT NULL,
  "channel"   TEXT         NOT NULL DEFAULT 'EMAIL',
  "enabled"   BOOLEAN      NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_type_channel_key"
  ON "NotificationPreference" ("userId", "type", "channel");

CREATE INDEX IF NOT EXISTS "NotificationPreference_userId_idx"
  ON "NotificationPreference" ("userId");
