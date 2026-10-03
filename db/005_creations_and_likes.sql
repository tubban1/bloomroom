-- 005_creations_and_likes.sql
-- Migration: Add creations (gallery artworks), likes, and link postcards to creations

-- 1. Creations table
CREATE TABLE IF NOT EXISTS bloomroom.creations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES bloomroom.users(id) ON DELETE SET NULL,
  source_draft_id UUID REFERENCES bloomroom.drafts(id) ON DELETE SET NULL,
  title VARCHAR(64) NOT NULL DEFAULT '未命名花束',
  bouquet_data JSONB NOT NULL,
  preview_image_path TEXT,
  preview_image_data TEXT,
  visibility VARCHAR(16) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for public listing and sorting
CREATE INDEX IF NOT EXISTS idx_creations_public_latest
  ON bloomroom.creations (published_at DESC, id DESC)
  WHERE visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_creations_public_popular
  ON bloomroom.creations (like_count DESC, published_at DESC, id DESC)
  WHERE visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_creations_owner_updated
  ON bloomroom.creations (owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_creations_source_draft
  ON bloomroom.creations (source_draft_id)
  WHERE source_draft_id IS NOT NULL;

REVOKE ALL ON bloomroom.creations FROM PUBLIC, anon, authenticated;
ALTER TABLE bloomroom.creations ENABLE ROW LEVEL SECURITY;

-- 2. Likes table
CREATE TABLE IF NOT EXISTS bloomroom.creation_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creation_id UUID NOT NULL REFERENCES bloomroom.creations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES bloomroom.users(id) ON DELETE CASCADE,
  guest_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_like_identity CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL) OR
    (user_id IS NULL AND guest_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_creation_user_like
  ON bloomroom.creation_likes (creation_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_creation_guest_like
  ON bloomroom.creation_likes (creation_id, guest_id)
  WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creation_likes_creation
  ON bloomroom.creation_likes (creation_id);

CREATE INDEX IF NOT EXISTS idx_creation_likes_guest
  ON bloomroom.creation_likes (guest_id)
  WHERE guest_id IS NOT NULL;

REVOKE ALL ON bloomroom.creation_likes FROM PUBLIC, anon, authenticated;
ALTER TABLE bloomroom.creation_likes ENABLE ROW LEVEL SECURITY;

-- 3. Link postcards to creations (nullable, backwards-compatible)
ALTER TABLE bloomroom.postcards
  ADD COLUMN IF NOT EXISTS creation_id UUID REFERENCES bloomroom.creations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_postcards_creation_id
  ON bloomroom.postcards (creation_id)
  WHERE creation_id IS NOT NULL;
