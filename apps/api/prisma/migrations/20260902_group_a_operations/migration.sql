ALTER TYPE "BookingStatus" ADD VALUE 'NO_SHOW';

ALTER TABLE "BookingDetail"
  ADD COLUMN "relocatedFrom" TEXT,
  ADD COLUMN "relocationReason" TEXT,
  ADD COLUMN "relocatedAt" TIMESTAMP(3),
  ADD COLUMN "relocatedBy" TEXT;
