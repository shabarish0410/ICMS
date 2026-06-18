import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

// Secure storage helper utilizing Capacitor Preferences on mobile and localStorage on web
export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    try {
      if ((window as any).Capacitor) {
        const { value } = await Preferences.get({ key });
        return value;
      }
    } catch (e) {
      console.warn('Capacitor Preferences not available, falling back to localStorage:', e);
    }
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      if ((window as any).Capacitor) {
        await Preferences.set({ key, value });
        return;
      }
    } catch (e) {
      console.warn('Capacitor Preferences not available, falling back to localStorage:', e);
    }
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      if ((window as any).Capacitor) {
        await Preferences.remove({ key });
        return;
      }
    } catch (e) {
      console.warn('Capacitor Preferences not available, falling back to localStorage:', e);
    }
    localStorage.removeItem(key);
  }
};

const getBaseURL = () => {
  if (typeof window === 'undefined') return '/api';
  
  const cap = (window as any).Capacitor;
  if (cap) {
    const isAndroid = /android/i.test(navigator.userAgent);
    return isAndroid ? 'http://10.0.2.2:8000/api' : 'http://localhost:8000/api';
  }
  
  return '/api';
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach JWT token asynchronously
api.interceptors.request.use(async (config) => {
  const token = await secureStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401 & token refresh asynchronously
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await secureStorage.getItem('refresh_token');
        if (refreshToken) {
          const res = await axios.post(
            (process.env.NEXT_PUBLIC_API_URL || getBaseURL()) + '/auth/refresh',
            { refresh_token: refreshToken }
          );
          await secureStorage.setItem('access_token', res.data.access_token);
          await secureStorage.setItem('refresh_token', res.data.refresh_token);
          originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
          return api(originalRequest);
        }
      } catch {
        await secureStorage.removeItem('access_token');
        await secureStorage.removeItem('refresh_token');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ───────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data: { ic_number: string; password: string }) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  completeProfile: (data: { full_name: string; email: string; mobile: string; avatar_url?: string }) =>
    api.put('/auth/complete-profile', data),
  changePassword: (data: { new_password: string }) => api.put('/auth/change-password', data),
  refresh: (refresh_token: string) => api.post('/auth/refresh', { refresh_token }),
  forgotPassword: (data: { ic_number: string; method: string }) => api.post('/auth/forgot-password', data),
  verifyOtp: (data: { ic_number: string; otp: string; new_password: string }) =>
    api.post('/auth/verify-otp', data),
  logout: () => api.post('/auth/logout'),
  requestOtp: (mobile: string) => api.post('/auth/register/request-otp', { mobile }),
  register: (data: any) => api.post('/auth/register', data),
  googleLogin: (idToken: string) => api.post('/auth/google', { id_token: idToken }),
};

// ─── Dashboard API ──────────────────────────────────────────────────────────
export const dashboardAPI = {
  admin: () => api.get('/dashboard/admin'),
  student: () => api.get('/dashboard/student'),
  attendanceTrend: () => api.get('/dashboard/charts/attendance-trend'),
  projectStatus: () => api.get('/dashboard/charts/project-status'),
  departmentChart: () => api.get('/dashboard/charts/department-distribution'),
};

// ─── Students API ───────────────────────────────────────────────────────────
export const studentsAPI = {
  list: (params?: Record<string, any>) => api.get('/students', { params }),
  get: (id: number) => api.get(`/students/${id}`),
  create: (data: any) => api.post('/students', data),
  update: (id: number, data: any) => api.put(`/students/${id}`, data),
  delete: (id: number) => api.delete(`/students/${id}`),
  departments: () => api.get('/students/departments/list'),
  getSelfProfile: () => api.get('/students/profile/self'),
  updateSelfProfile: (data: any) => api.put('/students/profile/self', data),
};

// ─── Teams API ──────────────────────────────────────────────────────────────
export const teamsAPI = {
  list: (params?: Record<string, any>) => api.get('/teams', { params }),
  get: (id: number) => api.get(`/teams/${id}`),
  create: (data: any) => api.post('/teams', data),
  update: (id: number, data: any) => api.put(`/teams/${id}`, data),
  delete: (id: number) => api.delete(`/teams/${id}`),
  members: (id: number) => api.get(`/teams/${id}/members`),
};

// ─── Projects API ───────────────────────────────────────────────────────────
export const projectsAPI = {
  list: (params?: Record<string, any>) => api.get('/projects', { params }),
  get: (id: number) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: number, data: any) => api.put(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  submissions: (projectId: number) => api.get(`/projects/${projectId}/submissions`),
  createSubmission: (projectId: number, data: any) => api.post(`/projects/${projectId}/submissions`, data),
  reviewSubmission: (projectId: number, submissionId: number, data: any) =>
    api.put(`/projects/${projectId}/submissions/${submissionId}/review`, data),
};

// ─── Dynamic Forms API ──────────────────────────────────────────────────────
export const formsAPI = {
  list: (params?: Record<string, any>) => api.get('/forms', { params }),
  get: (id: number) => api.get(`/forms/${id}`),
  create: (data: any) => api.post('/forms', data),
  update: (id: number, data: any) => api.put(`/forms/${id}`, data),
  delete: (id: number) => api.delete(`/forms/${id}`),
  submit: (formId: number, data: any) => api.post(`/forms/${formId}/submit`, data),
  duplicate: (formId: number) => api.post(`/forms/${formId}/duplicate`),
  responses: (formId: number, params?: Record<string, any>) =>
    api.get(`/forms/${formId}/responses`, { params }),
  reviewResponse: (formId: number, responseId: number, status: string, remarks: string) =>
    api.put(`/forms/${formId}/responses/${responseId}/review`, null, { params: { status, admin_remarks: remarks } }),
};

// ─── Weekly Reports API ─────────────────────────────────────────────────────
export const weeklyReportsAPI = {
  list: (params?: Record<string, any>) => api.get('/weekly-reports', { params }),
  submit: (data: any) => api.post('/weekly-reports', data),
  review: (id: number, data: any) => api.put(`/weekly-reports/${id}/review`, data),
};

// ─── Announcements API ──────────────────────────────────────────────────────
export const announcementsAPI = {
  list: (params?: Record<string, any>) => api.get('/announcements', { params }),
  create: (data: any) => api.post('/announcements', data),
  update: (id: number, data: any) => api.put(`/announcements/${id}`, data),
  delete: (id: number) => api.delete(`/announcements/${id}`),
};

// ─── Meetings API ───────────────────────────────────────────────────────────
export const meetingsAPI = {
  list: (params?: Record<string, any>) => api.get('/meetings', { params }),
  get: (id: number) => api.get(`/meetings/${id}`),
  create: (data: any) => api.post('/meetings', data),
  update: (id: number, data: any) => api.put(`/meetings/${id}`, data),
  delete: (id: number) => api.delete(`/meetings/${id}`),
  invitees: (id: number) => api.get(`/meetings/${id}/invitees`),
};

// ─── Attendance API ─────────────────────────────────────────────────────────
export const attendanceAPI = {
  mark: (data: { method: string; photo_url?: string }) => api.post('/attendance/mark', data),
  list: (params?: Record<string, any>) => api.get('/attendance', { params }),
  stats: () => api.get('/attendance/stats'),
  monthly: (params?: Record<string, any>) => api.get('/attendance/monthly', { params }),
  adminMark: (data: { student_id: number; date: string; status: string; method?: string }) => api.post('/attendance/admin/mark', data),
};

// ─── Uploads API ────────────────────────────────────────────────────────────
export const uploadsAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ─── Events API ─────────────────────────────────────────────────────────────
export const eventsAPI = {
  list: (params?: Record<string, any>) => api.get('/events', { params }),
  get: (id: number) => api.get(`/events/${id}`),
  create: (data: any) => api.post('/events', data),
  update: (id: number, data: any) => api.put(`/events/${id}`, data),
  delete: (id: number) => api.delete(`/events/${id}`),
  register: (id: number) => api.post(`/events/${id}/register`),
};

// ─── Notifications API ─────────────────────────────────────────────────────
export const notificationsAPI = {
  list: (params?: Record<string, any>) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: number) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export default api;
