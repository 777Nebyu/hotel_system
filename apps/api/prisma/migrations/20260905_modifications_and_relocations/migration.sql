-- CreateTable
CREATE TABLE "BookingModification" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "previousCheckIn" DATE NOT NULL,
    "previousCheckOut" DATE NOT NULL,
    "newCheckIn" DATE NOT NULL,
    "newCheckOut" DATE NOT NULL,
    "previousTotalPrice" DECIMAL(10,2) NOT NULL,
    "newTotalPrice" DECIMAL(10,2) NOT NULL,
    "priceDifference" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingModification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomRelocation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bookingDetailId" TEXT NOT NULL,
    "oldRoomId" TEXT NOT NULL,
    "newRoomId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "relocatedById" TEXT NOT NULL,
    "relocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomRelocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingModification_bookingId_idx" ON "BookingModification"("bookingId");

-- CreateIndex
CREATE INDEX "BookingModification_requestedById_idx" ON "BookingModification"("requestedById");

-- CreateIndex
CREATE INDEX "RoomRelocation_bookingId_idx" ON "RoomRelocation"("bookingId");

-- CreateIndex
CREATE INDEX "RoomRelocation_oldRoomId_idx" ON "RoomRelocation"("oldRoomId");

-- CreateIndex
CREATE INDEX "RoomRelocation_newRoomId_idx" ON "RoomRelocation"("newRoomId");

-- AddForeignKey
ALTER TABLE "BookingModification" ADD CONSTRAINT "BookingModification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingModification" ADD CONSTRAINT "BookingModification_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRelocation" ADD CONSTRAINT "RoomRelocation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRelocation" ADD CONSTRAINT "RoomRelocation_oldRoomId_fkey" FOREIGN KEY ("oldRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRelocation" ADD CONSTRAINT "RoomRelocation_newRoomId_fkey" FOREIGN KEY ("newRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRelocation" ADD CONSTRAINT "RoomRelocation_relocatedById_fkey" FOREIGN KEY ("relocatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
