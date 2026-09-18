-- Keep the Review table aligned with prisma/schema.prisma.
ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "response" TEXT,
  ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "respondedById" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Review_respondedById_idx"
  ON "Review"("respondedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Review_respondedById_fkey'
  ) THEN
    ALTER TABLE "Review"
      ADD CONSTRAINT "Review_respondedById_fkey"
      FOREIGN KEY ("respondedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
