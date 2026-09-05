-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "ContactThread" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "bookingId" TEXT,
    "subject" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactThread_customerId_idx" ON "ContactThread"("customerId");

-- CreateIndex
CREATE INDEX "ContactThread_hotelId_idx" ON "ContactThread"("hotelId");

-- CreateIndex
CREATE INDEX "ContactThread_bookingId_idx" ON "ContactThread"("bookingId");

-- CreateIndex
CREATE INDEX "ContactMessage_threadId_idx" ON "ContactMessage"("threadId");

-- CreateIndex
CREATE INDEX "ContactMessage_senderId_idx" ON "ContactMessage"("senderId");

-- AddForeignKey
ALTER TABLE "ContactThread" ADD CONSTRAINT "ContactThread_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactThread" ADD CONSTRAINT "ContactThread_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactThread" ADD CONSTRAINT "ContactThread_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ContactThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
