-- 004_ai_reading_in_drafts.sql
-- Migration: Add nullable ai_reading JSONB column to drafts table

ALTER TABLE bloomroom.drafts
  ADD COLUMN IF NOT EXISTS ai_reading JSONB;
