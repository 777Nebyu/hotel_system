CREATE TYPE "StayRequestType" AS ENUM ('EARLY_CHECKIN', 'LATE_CHECKOUT');

CREATE TYPE "StayRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Booking"
  ADD COLUMN "actualCheckIn" TIMESTAMP(3),
  ADD COLUMN "actualCheckOut" TIMESTAMP(3),
  ADD COLUMN "earlyCheckIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "earlyCheckInFee" DECIMAL(10,2),
  ADD COLUMN "lateCheckOut" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lateCheckOutFee" DECIMAL(10,2);

CREATE TABLE "RoomHold" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "holdStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "holdEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomHold_roomId_holdEnd_idx" ON "RoomHold"("roomId", "holdEnd");
CREATE INDEX "RoomHold_userId_status_idx" ON "RoomHold"("userId", "status");

ALTER TABLE "RoomHold"
  ADD CONSTRAINT "RoomHold_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomHold"
  ADD CONSTRAINT "RoomHold_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StayRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "StayRequestType" NOT NULL,
    "status" "StayRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedTime" TEXT,
    "fee" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "guestConsent" BOOLEAN NOT NULL DEFAULT false,
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StayRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StayRequest_bookingId_idx" ON "StayRequest"("bookingId");
CREATE INDEX "StayRequest_status_idx" ON "StayRequest"("status");

ALTER TABLE "StayRequest"
  ADD CONSTRAINT "StayRequest_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StayRequest"
  ADD CONSTRAINT "StayRequest_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
