-- Migration: add status column to contacts
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'pending'));
