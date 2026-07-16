-- =============================================================================
-- Migration: V2_face_pipeline
-- Description: Face Registration V2 — additive schema changes only
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING
-- Applied by: INSERT INTO schema_migrations is idempotent (ON CONFLICT DO NOTHING)
-- =============================================================================

BEGIN;

-- ── Migration tracking ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     text PRIMARY KEY,
    applied_at  timestamptz DEFAULT now(),
    description text
);

INSERT INTO schema_migrations (version, description)
VALUES (
    'V2_face_pipeline',
    'Face Registration V2: versioned embeddings, audit logs, idempotency, pgvector support, Drive metadata, indexes'
)
ON CONFLICT (version) DO NOTHING;

-- ── pgvector extension (fails gracefully on unsupported Supabase plans) ───────
DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE 'pgvector extension is available';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available — jsonb fallback will be used';
END $$;

-- ── Utility RPC: pgvector availability detection ──────────────────────────────
-- Called at startup by embedding_store.detect_backend()
CREATE OR REPLACE FUNCTION check_pgvector()
RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector');
$$;

-- ── students: new face-related columns ───────────────────────────────────────
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS face_image_url        text,
    ADD COLUMN IF NOT EXISTS face_drive_file_id    text,
    ADD COLUMN IF NOT EXISTS face_web_view_link    text,
    ADD COLUMN IF NOT EXISTS face_direct_link      text,
    ADD COLUMN IF NOT EXISTS face_image_hash       varchar(64);

-- ── student_faces: enriched metadata ─────────────────────────────────────────
ALTER TABLE student_faces
    ADD COLUMN IF NOT EXISTS drive_file_id           text,
    ADD COLUMN IF NOT EXISTS web_view_link           text,
    ADD COLUMN IF NOT EXISTS direct_download_link    text,
    ADD COLUMN IF NOT EXISTS image_hash              varchar(64),
    ADD COLUMN IF NOT EXISTS embedding_version       integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS embedding_model         varchar(50) DEFAULT 'ArcFace',
    ADD COLUMN IF NOT EXISTS embedding_model_version varchar(20) DEFAULT '1.0',
    ADD COLUMN IF NOT EXISTS mediapipe_version       varchar(20),
    ADD COLUMN IF NOT EXISTS face_confidence         float,
    ADD COLUMN IF NOT EXISTS quality_score           float,
    ADD COLUMN IF NOT EXISTS request_id              varchar(30),
    ADD COLUMN IF NOT EXISTS upload_timestamp        timestamptz;

-- pgvector column: only added if the extension is available
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        ALTER TABLE student_faces
            ADD COLUMN IF NOT EXISTS face_embedding_vec vector(512);
        RAISE NOTICE 'Added face_embedding_vec vector(512) to student_faces';
    ELSE
        RAISE NOTICE 'Skipping vector column — pgvector not available on this Supabase plan';
    END IF;
END $$;

-- ── face_registration_history ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS face_registration_history (
    id                      serial PRIMARY KEY,
    student_id              integer REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    face_embedding          jsonb NOT NULL,
    face_image_url          text,
    web_view_link           text,
    direct_download_link    text,
    drive_file_id           text,
    image_hash              varchar(64),
    embedding_model         varchar(50) DEFAULT 'ArcFace',
    embedding_model_version varchar(20) DEFAULT '1.0',
    mediapipe_version       varchar(20),
    embedding_version       integer NOT NULL,
    quality_score           float,
    face_confidence         float,
    challenge_type          varchar(20),
    request_id              varchar(30),
    registered_at           timestamptz DEFAULT now()
);

-- ── face_idempotency_cache ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS face_idempotency_cache (
    id              serial PRIMARY KEY,
    idempotency_key varchar(100) UNIQUE NOT NULL,
    student_id      integer,
    status          varchar(20) NOT NULL,   -- 'processing' | 'completed' | 'failed'
    result_json     jsonb,
    created_at      timestamptz DEFAULT now(),
    expires_at      timestamptz NOT NULL
);

-- ── face_audit_logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS face_audit_logs (
    id             serial PRIMARY KEY,
    student_id     integer REFERENCES students(id) ON DELETE SET NULL,
    request_id     varchar(30),
    ip_address     varchar(50),
    user_agent     text,
    challenge_type varchar(20),
    stage          varchar(50),
    result         varchar(20),       -- PASS | FAIL | ERROR | DUPLICATE
    failure_reason text,
    duration_ms    integer,
    timestamp      timestamptz DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- student_faces
CREATE INDEX IF NOT EXISTS idx_student_faces_hash
    ON student_faces(image_hash);
CREATE INDEX IF NOT EXISTS idx_student_faces_request
    ON student_faces(request_id);
CREATE INDEX IF NOT EXISTS idx_student_faces_drive_file
    ON student_faces(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_student_faces_model
    ON student_faces(embedding_model, embedding_model_version);

-- students
CREATE INDEX IF NOT EXISTS idx_students_drive_file
    ON students(face_drive_file_id);
CREATE INDEX IF NOT EXISTS idx_students_face_hash
    ON students(face_image_hash);

-- face_registration_history
CREATE INDEX IF NOT EXISTS idx_reg_history_student
    ON face_registration_history(student_id);
CREATE INDEX IF NOT EXISTS idx_reg_history_request
    ON face_registration_history(request_id);
CREATE INDEX IF NOT EXISTS idx_reg_history_timestamp
    ON face_registration_history(registered_at);

-- face_idempotency_cache
CREATE INDEX IF NOT EXISTS idx_idempotency_key
    ON face_idempotency_cache(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires
    ON face_idempotency_cache(expires_at);

-- face_audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_student
    ON face_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_request
    ON face_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp
    ON face_audit_logs(timestamp);

COMMIT;

-- =============================================================================
-- Verification queries (run these after applying the migration):
--
--   SELECT * FROM schema_migrations WHERE version = 'V2_face_pipeline';
--   SELECT check_pgvector();
--   \d student_faces
--   \d face_registration_history
--   \d face_idempotency_cache
--   \d face_audit_logs
-- =============================================================================
