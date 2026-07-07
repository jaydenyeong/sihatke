-- Sihaty database schema
-- Run this in Supabase Dashboard → SQL Editor → New query → paste → Run

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing objects (safe to re-run during dev)
DROP TABLE IF EXISTS sunshines   CASCADE;
DROP TABLE IF EXISTS push_tokens CASCADE;
DROP TABLE IF EXISTS alerts      CASCADE;
DROP TABLE IF EXISTS contacts    CASCADE;
DROP TABLE IF EXISTS checkins    CASCADE;
DROP TABLE IF EXISTS users       CASCADE;
DROP TYPE  IF EXISTS push_platform;
DROP TYPE  IF EXISTS alert_status;
DROP TYPE  IF EXISTS alert_type;
DROP TYPE  IF EXISTS status_level;

-- Enums
CREATE TYPE status_level  AS ENUM ('great', 'okay', 'not_great', 'need_help');
CREATE TYPE alert_type    AS ENUM ('need_help', 'missed_checkin', 'decline_pattern');
CREATE TYPE alert_status  AS ENUM ('sent', 'seen', 'responded');
CREATE TYPE push_platform AS ENUM ('ios', 'android');

-- Users (auth + profile)
CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  full_name          TEXT NOT NULL,
  avatar_url         TEXT,
  date_of_birth      DATE,
  checkin_times      TEXT[] NOT NULL DEFAULT ARRAY['09:00'],
  checkin_frequency  INT  NOT NULL DEFAULT 1 CHECK (checkin_frequency BETWEEN 1 AND 5),
  timezone           TEXT NOT NULL DEFAULT 'UTC',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Check-ins
CREATE TABLE checkins (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  physical_status  status_level NOT NULL,
  mental_status    status_level NOT NULL,
  note             TEXT,
  voice_note_url   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkins_user_created ON checkins (user_id, created_at DESC);

-- Trusted contacts
CREATE TABLE contacts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  phone              TEXT,
  email              TEXT,
  relationship       TEXT,
  notify_on_help     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_missed   BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_decline  BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency       BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order         INT NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_user ON contacts (user_id);

-- Alerts
CREATE TABLE alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  alert_type  alert_type NOT NULL,
  message     TEXT,
  status      alert_status NOT NULL DEFAULT 'sent',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_user_created ON alerts (user_id, created_at DESC);

-- Push tokens
CREATE TABLE push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    push_platform NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sunshine reactions (family → sender)
CREATE TABLE sunshines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sunshines_to      ON sunshines (to_user_id, created_at DESC);
CREATE INDEX idx_sunshines_from_to ON sunshines (from_user_id, to_user_id, created_at DESC);

-- updated_at auto-touch trigger
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_touch_updated_at       BEFORE UPDATE ON users       FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER contacts_touch_updated_at    BEFORE UPDATE ON contacts    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER alerts_touch_updated_at      BEFORE UPDATE ON alerts      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER push_tokens_touch_updated_at BEFORE UPDATE ON push_tokens FOR EACH ROW EXECUTE FUNCTION touch_updated_at();