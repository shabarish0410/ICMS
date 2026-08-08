-- Migration 011: Smart QR Attendance Tables
-- Creates the required sessions and records tables

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_name TEXT NOT NULL,
    section TEXT,
    faculty_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    gps_radius DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL
        REFERENCES attendance_sessions(id)
        ON DELETE CASCADE,
    student_id INTEGER NOT NULL
        REFERENCES students(id),
    student_name TEXT,
    student_identifier TEXT,
    marked_at TIMESTAMPTZ DEFAULT NOW(),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    device_id TEXT,
    UNIQUE(session_id, student_id)
);

-- Enable RLS
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Note: Actual data access will be enforced in Supabase Edge Functions using the service role key,
-- so RLS policies for browser access can be left restrictive or added if frontend subscriptions need them.
