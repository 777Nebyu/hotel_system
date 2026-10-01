ALTER TABLE "User"
  ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mfaSecretEncrypted" TEXT,
  ADD COLUMN "mfaPendingSecretEncrypted" TEXT,
  ADD COLUMN "mfaChallengeHash" TEXT,
  ADD COLUMN "mfaChallengeExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_mfaChallengeHash_key" ON "User"("mfaChallengeHash");
