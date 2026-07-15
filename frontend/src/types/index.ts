// ─── Core ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  ic_number: string;
  full_name: string;
  email?: string;
  mobile?: string;
  avatar_url?: string;
  role?: Role;
  is_active: boolean;
  is_profile_completed: boolean;
  must_change_password?: boolean;
  created_at?: string;
  student?: Student;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
}

// ─── Student & Team ──────────────────────────────────────────────────────────

export interface Student {
  id: number;
  user_id: number;
  department: string;
  year: number;
  semester?: number;
  mentor_name?: string;
  team_id?: number;
  team?: Team;
  user?: User;
  created_at?: string;
  bio?: string;
  skills?: string[];
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  achievements?: any;
  certifications?: any;
  resume_url?: string;
}

export interface Team {
  id: number;
  name: string;
  description?: string;
  department?: string;
  mentor_name?: string;
  member_count?: number;
  created_at?: string;
}

// ─── Project ─────────────────────────────────────────────────────────────────

export interface Project {
  id: number;
  title: string;
  description?: string;
  status: string;
  category?: string;
  team_id?: number;
  start_date?: string;
  end_date?: string;
  progress: number;
  remarks?: string;
  team?: Team;
  created_at?: string;
}

export interface ProjectSubmission {
  id: number;
  project_id: number;
  submitted_by: number;
  submission_type: string;
  title: string;
  description?: string;
  file_url?: string;
  status: string;
  admin_comments?: string;
  submitted_at?: string;
  reviewed_at?: string;
  submitter?: User;
}

// ─── Dynamic Forms ───────────────────────────────────────────────────────────

export interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: Record<string, any>;
  default_value?: string;
}

export interface DynamicForm {
  id: number;
  title: string;
  description?: string;
  fields: FormField[];
  is_active: boolean;
  deadline?: string;
  created_by?: number;
  response_count?: number;
  created_at?: string;
}

export interface FormSubmission {
  id: number;
  form_id: number;
  user_id: number;
  data: Record<string, any>;
  status: string;
  admin_remarks?: string;
  submitted_at?: string;
  reviewed_at?: string;
  user?: User;
}

// ─── Weekly Reports ──────────────────────────────────────────────────────────

export interface WeeklyReport {
  id: number;
  student_id: number;
  week_number: number;
  work_completed: string;
  challenges?: string;
  next_plan?: string;
  attachments?: string[];
  status: string;
  admin_comments?: string;
  submitted_at?: string;
  reviewed_at?: string;
  student?: Student;
}

// ─── Announcements ───────────────────────────────────────────────────────────

export interface Announcement {
  id: number;
  title: string;
  description: string;
  attachment_url?: string;
  priority: string;
  expiry_date?: string;
  created_by?: number;
  creator?: User;
  created_at?: string;
}

// ─── Meetings ────────────────────────────────────────────────────────────────

export interface Meeting {
  id: number;
  title: string;
  agenda?: string;
  date: string;
  duration_minutes: number;
  meeting_link?: string;
  documents?: string[];
  recording_url?: string;
  created_by?: number;
  creator?: User;
  created_at?: string;
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: number;
  student_id: number;
  date: string;
  check_in_time?: string;
  method: string;
  status: string;
  student?: Student;
}

export interface AttendanceStats {
  total_days?: number;
  present?: number;
  late?: number;
  absent?: number;
  percentage: number;
  today_marked?: boolean;
  total_students?: number;
  present_today?: number;
  absent_today?: number;
  late_today?: number;
  attendance_percentage?: number;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export interface Event {
  id: number;
  title: string;
  description?: string;
  event_type: string;
  date: string;
  end_date?: string;
  venue?: string;
  max_participants?: number;
  status: string;
  image_url?: string;
  created_at?: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  link?: string;
  created_at?: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface AdminDashboardStats {
  total_students: number;
  total_teams: number;
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  pending_reviews: number;
  students_present_today: number;
  students_absent_today: number;
  attendance_percentage: number;
  forms_pending: number;
  upcoming_meetings: number;
  total_events: number;
}

export interface StudentDashboardData {
  user?: User;
  student?: Student;
  team?: Team;
  project?: Project;
  attendance_percentage: number;
  weekly_progress?: WeeklyReport;
  pending_forms: number;
  upcoming_meetings: number;
  recent_notifications: Notification[];
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label?: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    fill?: boolean;
  }[];
}
