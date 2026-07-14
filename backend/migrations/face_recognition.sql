-- ============================================================
-- Face Recognition Attendance - Database Migration
-- Run this in the Supabase SQL editor (or via psql)
-- ============================================================

-- ── 1. Add face registration columns to students ──────────────────────────────
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS face_register      BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS face_registered_at   TIMESTAMPTZ;

-- Enable the pgvector extension for Supabase
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Create student_faces table (stores ArcFace embeddings) ──────────────────
CREATE TABLE IF NOT EXISTS student_faces (
  id               SERIAL PRIMARY KEY,
  student_id       INTEGER NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  face_embedding   vector(512) NOT NULL,   -- 512-dim float list from ArcFace model
  model_version    TEXT    DEFAULT 'ArcFace',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_faces_student_id ON student_faces(student_id);

-- ── 3. Add face/liveness verification columns to attendance ────────────────────
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS face_verified       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS liveness_verified   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dress_verified      BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS attendance_method   TEXT    DEFAULT 'manual';

-- ── 4. Create attendance_logs table (validation audit trail) ───────────────────
CREATE TABLE IF NOT EXISTS attendance_logs (
  id               SERIAL PRIMARY KEY,
  student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  validation_step  TEXT    NOT NULL,   -- e.g. 'face_detect', 'liveness_check', 'face_match'
  result           TEXT    NOT NULL,   -- 'PASS', 'FAIL', 'INFO'
  message          TEXT,               -- Human-readable message
  timestamp        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_att_logs_student_id ON attendance_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_att_logs_timestamp   ON attendance_logs(timestamp DESC);

-- ── 5. RLS Policies ────────────────────────────────────────────────────────────
-- (Skip if you are managing auth at the application layer with service keys)

-- Enable RLS on student_faces
ALTER TABLE student_faces ENABLE ROW LEVEL SECURITY;

-- Allow all operations via service role (FastAPI uses service key)
CREATE POLICY "service_all_student_faces"
  ON student_faces FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_attendance_logs"
  ON attendance_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 6. Supabase Storage Bucket (run via API or dashboard) ─────────────────────
-- Create a public bucket named 'attendance-photos' in the Supabase dashboard.
-- Or use the API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', true);

-- ── 7. Face Matching RPC Function (pgvector 1:N search) ─────────────────────
CREATE OR REPLACE FUNCTION match_face(query_embedding vector(512), match_threshold float)
RETURNS TABLE (
  student_id integer,
  distance float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sf.student_id,
    (sf.face_embedding <=> query_embedding) AS distance
  FROM student_faces sf
  WHERE (sf.face_embedding <=> query_embedding) < match_threshold
  ORDER BY sf.face_embedding <=> query_embedding
  LIMIT 1;
END;
$$;

SELECT 'Migration completed successfully' AS status;
