-- Migration 009: Stabilize Schema by merging student_faces into students and adding Drive IDs

-- 1. Add columns to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS face_embedding JSONB,
ADD COLUMN IF NOT EXISTS face_image_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS face_drive_file_id VARCHAR(255);

-- 2. Add columns to attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255);

-- 3. Data Migration: Copy existing data from student_faces to students
-- We only copy where students.face_embedding IS NULL to prevent overwriting if run multiple times.
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_faces'
    ) THEN
        UPDATE students s
        SET 
            face_embedding = sf.face_embedding,
            face_image_url = sf.face_image_url,
            -- If face_image_url is a Google Drive URL, we might try to extract the ID, but for now we leave drive_file_id NULL or map it later if needed.
            face_register = TRUE
        FROM student_faces sf
        WHERE s.id = sf.student_id
        AND s.face_embedding IS NULL;
    END IF;
END $$;

-- 4. Drop the student_faces table as it is no longer the source of truth
DROP TABLE IF EXISTS student_faces;
