-- Migration: 010_student_achievements.sql
-- Description: Create student_achievements table for the Achievements & Certifications module, replacing the old certificates table.

-- Drop old certificates table if it exists (assuming no critical data yet, or to recreate)
DROP TABLE IF EXISTS certificates CASCADE;

-- Create student_achievements table
CREATE TABLE student_achievements (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    issuer VARCHAR(255),
    issue_date DATE,
    certificate_url TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ
);
