-- Supabase SQL Schema for ICMS Application

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Drop existing tables if they exist to start fresh (in correct dependency order)
drop table if exists otp_verifications cascade;
drop table if exists activity_logs cascade;
drop table if exists notifications cascade;
drop table if exists certificates cascade;
drop table if exists registrations cascade;
drop table if exists events cascade;
drop table if exists attendance cascade;
drop table if exists meeting_invites cascade;
drop table if exists meetings cascade;
drop table if exists announcements cascade;
drop table if exists weekly_reports cascade;
drop table if exists form_submissions cascade;
drop table if exists dynamic_forms cascade;
drop table if exists project_submissions cascade;
drop table if exists projects cascade;
drop table if exists team_members cascade;
drop table if exists students cascade;
drop table if exists teams cascade;
drop table if exists users cascade;
drop table if exists roles cascade;

-- 1. Roles
create table roles (
    id serial primary key,
    name varchar(50) unique not null,
    description varchar(255),
    created_at timestamptz default now()
);

-- 2. Users
create table users (
    id serial primary key,
    ic_number varchar(50) unique not null,
    password_hash varchar(255) not null,
    full_name varchar(255) not null,
    email varchar(255),
    mobile varchar(20),
    avatar_url text,
    role_id integer references roles(id) not null,
    is_active boolean default true,
    is_profile_completed boolean default false,
    must_change_password boolean default true,
    last_login timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 3. Teams
create table teams (
    id serial primary key,
    name varchar(255) unique not null,
    description text,
    department varchar(100),
    mentor_name varchar(255),
    created_at timestamptz default now()
);

-- 4. Students
create table students (
    id serial primary key,
    user_id integer references users(id) on delete cascade unique not null,
    department varchar(100) not null,
    year integer not null,
    semester integer,
    mentor_name varchar(255),
    team_id integer references teams(id),
    resume_url text,
    resume_data jsonb,
    face_registered boolean default false,
    face_registered_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 5. Team Members (Junction)
create table team_members (
    team_id integer references teams(id) on delete cascade,
    student_id integer references students(id) on delete cascade,
    primary key (team_id, student_id)
);

-- 6. Projects
create table projects (
    id serial primary key,
    title varchar(255) not null,
    description text,
    status varchar(50) default 'planning',
    category varchar(100),
    team_id integer references teams(id),
    start_date date,
    end_date date,
    progress integer default 0,
    remarks text,
    problem_statement text,
    proposed_solution text,
    development_stage varchar(100) default 'Ideation',
    technologies_used jsonb default '[]'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 7. Project Submissions
create table project_submissions (
    id serial primary key,
    project_id integer references projects(id) on delete cascade not null,
    submitted_by integer references users(id) not null,
    submission_type varchar(50) not null,
    title varchar(255) not null,
    description text,
    file_url text,
    status varchar(50) default 'submitted',
    admin_comments text,
    submitted_at timestamptz default now(),
    reviewed_at timestamptz
);

-- 8. Dynamic Forms
create table dynamic_forms (
    id serial primary key,
    title varchar(255) not null,
    description text,
    fields jsonb not null,
    is_active boolean default true,
    deadline timestamptz,
    created_by integer references users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 9. Form Submissions
create table form_submissions (
    id serial primary key,
    form_id integer references dynamic_forms(id) on delete cascade not null,
    user_id integer references users(id) on delete cascade not null,
    data jsonb not null,
    status varchar(50) default 'submitted',
    admin_remarks text,
    submitted_at timestamptz default now(),
    reviewed_at timestamptz
);

-- 10. Weekly Reports
create table weekly_reports (
    id serial primary key,
    student_id integer references students(id) on delete cascade not null,
    week_number integer not null,
    work_completed text not null,
    challenges text,
    next_plan text,
    attachments jsonb default '[]'::jsonb,
    status varchar(50) default 'submitted',
    admin_comments text,
    submitted_at timestamptz default now(),
    reviewed_at timestamptz
);

-- 11. Announcements
create table announcements (
    id serial primary key,
    title varchar(255) not null,
    description text not null,
    attachment_url text,
    priority varchar(20) default 'medium',
    expiry_date timestamptz,
    created_by integer references users(id),
    created_at timestamptz default now()
);

-- 12. Meetings
create table meetings (
    id serial primary key,
    title varchar(255) not null,
    agenda text,
    date timestamptz not null,
    duration_minutes integer default 60,
    meeting_link text,
    documents jsonb default '[]'::jsonb,
    recording_url text,
    created_by integer references users(id),
    created_at timestamptz default now()
);

-- 13. Meeting Invites (Junction)
create table meeting_invites (
    meeting_id integer references meetings(id) on delete cascade,
    user_id integer references users(id) on delete cascade,
    primary key (meeting_id, user_id)
);

-- 14. Attendance
create table attendance (
    id serial primary key,
    student_id integer references students(id) on delete cascade not null,
    date date not null,
    check_in_time timestamptz,
    check_out_time timestamptz,
    method varchar(50) default 'manual',
    status varchar(20) default 'present',
    photo_url text
);

-- 15. Events
create table events (
    id serial primary key,
    title varchar(255) not null,
    description text,
    event_type varchar(50) not null,
    date timestamptz not null,
    end_date timestamptz,
    venue varchar(255),
    max_participants integer,
    status varchar(50) default 'upcoming',
    image_url text,
    created_by integer references users(id),
    created_at timestamptz default now()
);

-- 16. Registrations
create table registrations (
    id serial primary key,
    event_id integer references events(id) on delete cascade not null,
    student_id integer references students(id) on delete cascade not null,
    status varchar(50) default 'registered',
    registered_at timestamptz default now()
);

-- 17. Student Achievements
create table student_achievements (
    id serial primary key,
    student_id integer references students(id) on delete cascade not null,
    title varchar(255) not null,
    description text,
    issuer varchar(255),
    issue_date date,
    certificate_url text,
    status varchar(50) default 'Pending',
    rejection_reason text,
    created_at timestamptz default now(),
    reviewed_by integer references users(id) on delete set null,
    reviewed_at timestamptz
);

-- 18. Notifications
create table notifications (
    id serial primary key,
    user_id integer references users(id) on delete cascade not null,
    title varchar(255) not null,
    message text not null,
    notification_type varchar(50) not null,
    is_read boolean default false,
    link text,
    created_at timestamptz default now()
);

-- 19. Activity Logs
create table activity_logs (
    id serial primary key,
    user_id integer references users(id) on delete set null,
    action varchar(100) not null,
    entity_type varchar(50),
    entity_id integer,
    details jsonb default '{}'::jsonb,
    ip_address varchar(50),
    timestamp timestamptz default now()
);

-- 20. OTP Verifications
create table otp_verifications (
    id serial primary key,
    identifier varchar(255) unique not null,
    otp_hash varchar(255) not null,
    attempts integer default 0,
    expires_at timestamptz not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 21. Student Faces
create table student_faces (
    id serial primary key,
    student_id integer references students(id) on delete cascade unique not null,
    face_embedding jsonb not null,
    model_version varchar(50) default 'ArcFace',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 22. Attendance Logs
create table attendance_logs (
    id serial primary key,
    student_id integer references students(id) on delete set null,
    validation_step varchar(100),
    result varchar(50),
    message text,
    timestamp timestamptz default now()
);

-- SEED DATA

-- Insert Roles
INSERT INTO roles (name, description) VALUES ('admin', 'Full system access');
INSERT INTO roles (name, description) VALUES ('student', 'Student access');

-- Insert Admin User (Password is 'Admin@123')
INSERT INTO users (ic_number, password_hash, full_name, email, mobile, role_id, is_active, is_profile_completed, must_change_password)
VALUES (
    'IC0000001', 
    '$2b$12$R.b.5z.5OQ7J5T0e.f45q.E0.kZ.Y0C/M0L/A5G.A0/h0f.e0B.pG',
    'Dr. Rajesh Kumar', 
    'admin@spark.edu', 
    '9876543210', 
    (SELECT id FROM roles WHERE name = 'admin'), 
    true, true, false
);
