ALTER TABLE "User"
  ADD COLUMN "isFlagged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "flagReason" TEXT,
  ADD COLUMN "flaggedAt" TIMESTAMP(3);

CREATE TABLE "UserSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "deviceName" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UserSession_userId_revokedAt_idx" ON "UserSession"("userId", "revokedAt");
CREATE INDEX "UserSession_family_idx" ON "UserSession"("family");
