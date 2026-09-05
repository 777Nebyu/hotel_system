CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'EMAIL_UNVERIFIED', 'SUSPENDED', 'DEACTIVATED', 'DELETED');

ALTER TABLE "User"
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletionScheduledFor" TIMESTAMP(3);

CREATE TABLE "BookingStatusHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BookingStatusHistory_bookingId_idx" ON "BookingStatusHistory"("bookingId");
