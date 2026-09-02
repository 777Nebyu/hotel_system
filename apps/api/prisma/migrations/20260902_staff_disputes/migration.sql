-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SuspensionRequestStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable: add isActive + minBookingAmount to Coupon
ALTER TABLE "Coupon"
  ADD COLUMN "isActive"         BOOLEAN          NOT NULL DEFAULT true,
  ADD COLUMN "minBookingAmount" DECIMAL(10,2);

-- CreateTable: StaffHotel
CREATE TABLE "StaffHotel" (
    "staffId"    TEXT NOT NULL,
    "hotelId"    TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffHotel_pkey" PRIMARY KEY ("staffId","hotelId")
);

CREATE INDEX "StaffHotel_hotelId_idx" ON "StaffHotel"("hotelId");

ALTER TABLE "StaffHotel"
  ADD CONSTRAINT "StaffHotel_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffHotel"
  ADD CONSTRAINT "StaffHotel_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Dispute
CREATE TABLE "Dispute" (
    "id"         TEXT NOT NULL,
    "bookingId"  TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason"     TEXT NOT NULL,
    "status"     "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Dispute_bookingId_idx" ON "Dispute"("bookingId");
CREATE INDEX "Dispute_status_idx"    ON "Dispute"("status");

ALTER TABLE "Dispute"
  ADD CONSTRAINT "Dispute_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Dispute"
  ADD CONSTRAINT "Dispute_openedById_fkey"
  FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: SuspensionRequest
CREATE TABLE "SuspensionRequest" (
    "id"          TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approverId"  TEXT,
    "targetType"  TEXT NOT NULL,
    "targetId"    TEXT NOT NULL,
    "reason"      TEXT NOT NULL,
    "status"      "SuspensionRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "decidedAt"   TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuspensionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SuspensionRequest_status_idx"              ON "SuspensionRequest"("status");
CREATE INDEX "SuspensionRequest_targetType_targetId_idx" ON "SuspensionRequest"("targetType","targetId");

ALTER TABLE "SuspensionRequest"
  ADD CONSTRAINT "SuspensionRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SuspensionRequest"
  ADD CONSTRAINT "SuspensionRequest_approverId_fkey"
  FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
