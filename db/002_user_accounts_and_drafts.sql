-- 002_user_accounts_and_drafts.sql
-- Migration: Add user accounts, sessions, drafts, and link postcards to users

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users table
CREATE TABLE IF NOT EXISTS bloomroom.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) NOT NULL,
  username_canonical VARCHAR(32) NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_username_canonical_unique UNIQUE (username_canonical),
  CONSTRAINT users_username_format CHECK (username_canonical ~ '^[a-z0-9_]{3,32}$')
);

REVOKE ALL ON bloomroom.users FROM PUBLIC, anon, authenticated;
ALTER TABLE bloomroom.users ENABLE ROW LEVEL SECURITY;

-- 2. Sessions table
CREATE TABLE IF NOT EXISTS bloomroom.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES bloomroom.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON bloomroom.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON bloomroom.sessions(token_hash);

REVOKE ALL ON bloomroom.sessions FROM PUBLIC, anon, authenticated;
ALTER TABLE bloomroom.sessions ENABLE ROW LEVEL SECURITY;

-- 3. Drafts table
CREATE TABLE IF NOT EXISTS bloomroom.drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES bloomroom.users(id) ON DELETE CASCADE,
  title VARCHAR(64) NOT NULL DEFAULT 'Untitled Bouquet',
  bouquet_data JSONB NOT NULL,
  preview_image TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT draft_title_length CHECK (length(title) <= 64),
  CONSTRAINT draft_preview_limit CHECK (preview_image IS NULL OR length(preview_image) <= 600000)
);

CREATE INDEX IF NOT EXISTS idx_drafts_user_updated ON bloomroom.drafts(user_id, updated_at DESC);

REVOKE ALL ON bloomroom.drafts FROM PUBLIC, anon, authenticated;
ALTER TABLE bloomroom.drafts ENABLE ROW LEVEL SECURITY;

-- 4. Postcards user_id link (nullable foreign key, backwards compatible)
ALTER TABLE bloomroom.postcards
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES bloomroom.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_postcards_user_created ON bloomroom.postcards(user_id, created_at DESC);
