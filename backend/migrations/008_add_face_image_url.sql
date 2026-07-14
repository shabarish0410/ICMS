-- Add face_image_url to student_faces table to store Google Drive URLs

ALTER TABLE public.student_faces
ADD COLUMN face_image_url VARCHAR(500) NULL;
