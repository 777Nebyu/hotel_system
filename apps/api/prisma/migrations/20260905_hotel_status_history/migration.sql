CREATE TABLE "HotelStatusHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hotelId" TEXT NOT NULL,
  "status" "HotelStatus" NOT NULL,
  "changedBy" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelStatusHistory_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "HotelStatusHistory_hotelId_idx" ON "HotelStatusHistory"("hotelId");
