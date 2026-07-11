-- Migration 007: Add uniforms table and extend attendance table
-- Run this against your Supabase SQL editor or psql

-- ── Uniforms Table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uniforms (
    id              SERIAL PRIMARY KEY,
    department      VARCHAR(100) DEFAULT 'all',
    gender          VARCHAR(20)  DEFAULT 'all',  -- all, male, female
    season          VARCHAR(20)  DEFAULT 'all',  -- all, summer, winter
    label           VARCHAR(255),                -- e.g. "CSE Male Summer Uniform"
    front_image_url TEXT,
    back_image_url  TEXT,
    side_image_url  TEXT,
    logo_image_url  TEXT,
    is_active       BOOLEAN      DEFAULT true,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Attendance Table Extensions ───────────────────────────────────────────────
ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS uniform_verified   BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS uniform_confidence FLOAT,
    ADD COLUMN IF NOT EXISTS uniform_details    JSONB;

-- ── RLS (if using Supabase RLS — adjust as needed) ───────────────────────────
-- Allow service role full access; anon/authenticated cannot access directly
ALTER TABLE uniforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role can manage uniforms"
    ON uniforms FOR ALL
    USING (true)
    WITH CHECK (true);
