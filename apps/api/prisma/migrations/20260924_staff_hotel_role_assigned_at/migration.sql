-- Align StaffHotel with Prisma schema: role title + assignedAt timestamp
ALTER TABLE "StaffHotel" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'Front Desk';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'StaffHotel' AND column_name = 'createdAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'StaffHotel' AND column_name = 'assignedAt'
  ) THEN
    ALTER TABLE "StaffHotel" RENAME COLUMN "createdAt" TO "assignedAt";
  END IF;
END $$;

ALTER TABLE "StaffHotel" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
