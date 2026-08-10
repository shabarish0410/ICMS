BEGIN;

-- ============================================================
-- attendance_sessions
-- ============================================================

DO $$
BEGIN

    -- gps_latitude -> generator_latitude
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'attendance_sessions'
        AND column_name = 'gps_latitude'
    ) THEN
        ALTER TABLE attendance_sessions
        RENAME COLUMN gps_latitude TO generator_latitude;
    END IF;

    -- gps_longitude -> generator_longitude
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'attendance_sessions'
        AND column_name = 'gps_longitude'
    ) THEN
        ALTER TABLE attendance_sessions
        RENAME COLUMN gps_longitude TO generator_longitude;
    END IF;

    -- gps_radius -> allowed_radius_meters
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'attendance_sessions'
        AND column_name = 'gps_radius'
    ) THEN
        ALTER TABLE attendance_sessions
        RENAME COLUMN gps_radius TO allowed_radius_meters;
    END IF;

END $$;

-- ============================================================
-- Add generator location metadata
-- ============================================================

ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS generator_accuracy_meters
    DOUBLE PRECISION;

ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS location_captured_at
    TIMESTAMPTZ;

-- ============================================================
-- attendance_records
-- ============================================================

ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS accuracy
    DOUBLE PRECISION;

-- ============================================================
-- Reasonable defaults
-- ============================================================

ALTER TABLE attendance_sessions
ALTER COLUMN allowed_radius_meters
SET DEFAULT 100;

COMMIT;
