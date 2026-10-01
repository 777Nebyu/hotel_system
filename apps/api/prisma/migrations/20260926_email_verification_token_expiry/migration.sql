-- AlterTable User: add emailVerified and verificationTokenExpiresAt
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationTokenExpiresAt" TIMESTAMP(3);

-- For existing users with emailVerifiedAt set, mark emailVerified as true
UPDATE "User" SET "emailVerified" = true WHERE "emailVerifiedAt" IS NOT NULL;
