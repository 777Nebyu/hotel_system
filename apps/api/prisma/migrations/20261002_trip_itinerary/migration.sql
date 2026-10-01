DO $$ BEGIN
  CREATE TYPE "TripItemType" AS ENUM ('PLACE', 'BOOKING', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TripItemStatus" AS ENUM ('PLANNED', 'DONE', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CreatedByOrigin" AS ENUM ('USER', 'AI');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Trip" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "hotelId" TEXT,
  "bookingId" TEXT,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TripItem" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "dayDate" DATE NOT NULL,
  "startTime" TEXT,
  "durationMin" INTEGER,
  "itemType" "TripItemType" NOT NULL,
  "placeId" TEXT,
  "bookingId" TEXT,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "costAmount" DECIMAL(10,2),
  "currency" TEXT DEFAULT 'ETB',
  "status" "TripItemStatus" NOT NULL DEFAULT 'PLANNED',
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdBy" "CreatedByOrigin" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TripItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Trip_userId_startDate_idx" ON "Trip"("userId", "startDate");
CREATE INDEX IF NOT EXISTS "TripItem_tripId_dayDate_startTime_idx" ON "TripItem"("tripId", "dayDate", "startTime");

ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "Trip_userId_fkey";
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "Trip_hotelId_fkey";
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "Trip_bookingId_fkey";
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TripItem" DROP CONSTRAINT IF EXISTS "TripItem_tripId_fkey";
ALTER TABLE "TripItem" ADD CONSTRAINT "TripItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripItem" DROP CONSTRAINT IF EXISTS "TripItem_placeId_fkey";
ALTER TABLE "TripItem" ADD CONSTRAINT "TripItem_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TripItem" DROP CONSTRAINT IF EXISTS "TripItem_bookingId_fkey";
ALTER TABLE "TripItem" ADD CONSTRAINT "TripItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
