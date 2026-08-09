-- Migration 012: Add RLS policies for Attendance
-- Required for Supabase Realtime and Student dashboard to read active sessions.

-- Allow anyone to read active attendance sessions
CREATE POLICY "Allow read access to active sessions" ON attendance_sessions
    FOR SELECT USING (is_active = true);

-- If students need to see their own records, you can add this:
-- CREATE POLICY "Students can view own records" ON attendance_records
--     FOR SELECT USING (true); -- Adjust according to your auth setup
