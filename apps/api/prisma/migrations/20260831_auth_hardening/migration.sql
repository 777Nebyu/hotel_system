-- Migration: auth_hardening
-- Adds four new columns to the "User" table to support:
--   1. lastLoginAt      — audit trail of most-recent successful login
--   2. loginAttempts    — rolling counter for failed login attempts (lockout)
--   3. lockedUntil      — account lockout expiry timestamp
--   4. refreshTokenFamily — token-family ID for compromise detection on refresh-token replay

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastLoginAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "loginAttempts"        INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refreshTokenFamily"   TEXT;
