-- Add profile fields to students table
ALTER TABLE public.students
ADD COLUMN linkedin_url VARCHAR(255) NULL,
ADD COLUMN github_url VARCHAR(255) NULL,
ADD COLUMN portfolio_url VARCHAR(255) NULL,
ADD COLUMN skills JSONB DEFAULT '[]'::jsonb,
ADD COLUMN bio TEXT NULL,
ADD COLUMN achievements JSONB DEFAULT '[]'::jsonb,
ADD COLUMN certifications JSONB DEFAULT '[]'::jsonb;
