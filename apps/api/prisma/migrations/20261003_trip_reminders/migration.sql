ALTER TABLE "TripItem" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "TripItem_reminderSentAt_idx"
  ON "TripItem"("reminderSentAt", "status", "dayDate");
