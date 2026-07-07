-- Migration: sunshine reactions (family → sender)
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS sunshines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sunshines_to
  ON sunshines (to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sunshines_from_to
  ON sunshines (from_user_id, to_user_id, created_at DESC);
