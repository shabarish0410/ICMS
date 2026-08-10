-- ============================================================
-- ICMS Attendance History — Migration
-- 20260810_attendance_history.sql
-- ============================================================
-- This migration:
-- 1. Adds the 'section' column to students table (if missing)
-- 2. Adds performance indexes for attendance reporting
--
-- No existing tables are modified destructively.
-- All attendance data remains in attendance_sessions + attendance_records.
-- ============================================================

-- ── 1. Add section column to students (safe — IF NOT EXISTS via check) ────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students' AND column_name = 'section'
    ) THEN
        ALTER TABLE students ADD COLUMN section VARCHAR(50);
        RAISE NOTICE 'Added section column to students table';
    ELSE
        RAISE NOTICE 'section column already exists in students table';
    END IF;
END $$;

-- ── 2. Indexes on attendance_sessions ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_section
    ON attendance_sessions(section);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_created_at
    ON attendance_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_expires_at
    ON attendance_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_faculty_id
    ON attendance_sessions(faculty_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_subject_name
    ON attendance_sessions(subject_name);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_is_active
    ON attendance_sessions(is_active);

-- ── 3. Indexes on attendance_records ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id
    ON attendance_records(session_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id
    ON attendance_records(student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_at
    ON attendance_records(marked_at);

-- Composite index: session + student lookup (most common report join)
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_student
    ON attendance_records(session_id, student_id);

-- ── 4. Indexes on students ────────────────────────────────────────────────────

-- Only add these indexes after the column is guaranteed to exist
CREATE INDEX IF NOT EXISTS idx_students_section
    ON students(section);

CREATE INDEX IF NOT EXISTS idx_students_user_id
    ON students(user_id);
