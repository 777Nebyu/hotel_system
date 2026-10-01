-- emailVerifiedAt is the canonical proof and audit timestamp.
-- Do not promote the legacy boolean: older code could set it without a
-- successful verification-link click. Only an existing timestamp is proof.

-- Keep the legacy compatibility mirror consistent with the canonical field.
UPDATE "User"
SET "emailVerified" = CASE
  WHEN "emailVerifiedAt" IS NOT NULL THEN true
  ELSE false
END;
