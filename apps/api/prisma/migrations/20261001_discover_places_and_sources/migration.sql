-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PlaceCategory" AS ENUM (
    'RESTAURANT',
    'CAFE',
    'HERITAGE',
    'MUSEUM',
    'ATTRACTION',
    'NIGHTLIFE',
    'SHOPPING',
    'HOSPITAL',
    'CLINIC',
    'PHARMACY',
    'EMERGENCY',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PlaceStatus" AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'PUBLISHED',
    'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable Source
CREATE TABLE IF NOT EXISTS "Source" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT,
  "license" TEXT,
  "verifiedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable Place
CREATE TABLE IF NOT EXISTS "Place" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amharicName" TEXT,
  "description" TEXT NOT NULL,
  "amharicDescription" TEXT,
  "category" "PlaceCategory" NOT NULL,
  "status" "PlaceStatus" NOT NULL DEFAULT 'PUBLISHED',
  "address" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "cityId" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "openingHours" TEXT,
  "hoursVerified" BOOLEAN NOT NULL DEFAULT false,
  "priceLevel" INTEGER DEFAULT 1,
  "rating" DOUBLE PRECISION DEFAULT 4.5,
  "images" JSONB,
  "sourceId" TEXT,
  "lastVerifiedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable EmergencyContact
CREATE TABLE IF NOT EXISTS "EmergencyContact" (
  "id" TEXT NOT NULL,
  "city" TEXT,
  "hotelId" TEXT,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "sourceId" TEXT,
  "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Place_category_idx" ON "Place"("category");
CREATE INDEX IF NOT EXISTS "Place_status_idx" ON "Place"("status");
CREATE INDEX IF NOT EXISTS "Place_cityId_idx" ON "Place"("cityId");
CREATE INDEX IF NOT EXISTS "Place_lat_lng_idx" ON "Place"("lat", "lng");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmergencyContact_city_idx" ON "EmergencyContact"("city");
CREATE INDEX IF NOT EXISTS "EmergencyContact_hotelId_idx" ON "EmergencyContact"("hotelId");
CREATE INDEX IF NOT EXISTS "EmergencyContact_kind_idx" ON "EmergencyContact"("kind");
CREATE INDEX IF NOT EXISTS "EmergencyContact_status_idx" ON "EmergencyContact"("status");

-- AddForeignKey
ALTER TABLE "Place" DROP CONSTRAINT IF EXISTS "Place_cityId_fkey";
ALTER TABLE "Place" ADD CONSTRAINT "Place_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" DROP CONSTRAINT IF EXISTS "Place_sourceId_fkey";
ALTER TABLE "Place" ADD CONSTRAINT "Place_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" DROP CONSTRAINT IF EXISTS "EmergencyContact_hotelId_fkey";
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" DROP CONSTRAINT IF EXISTS "EmergencyContact_sourceId_fkey";
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
