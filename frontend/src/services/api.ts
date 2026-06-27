import axios from 'axios';

// ─── Token Storage (sync-safe for web, no Capacitor dependency at module level) ──
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const tokenStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  },
  getRefreshToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  },
  setTokens: (access: string, refresh: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    // Also set a cookie so Next.js middleware (edge runtime) can read auth state
    document.cookie = `access_token=${access}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Strict`;
  },
  clearTokens: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    // Expire the cookie
    document.cookie = 'access_token=; path=/; max-age=0; SameSite=Strict';
  },
};

// ─── Legacy alias kept for backward compatibility ────────────────────────────
export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },
};

// ─── Base URL ────────────────────────────────────────────────────────────────
const getBaseURL = (): string => {
  // Priority: NEXT_PUBLIC_API_URL (full URL with /api) → NEXT_PUBLIC_BACKEND_URL (base URL)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window === 'undefined') return 'http://localhost:8000/api';

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

  // Capacitor native app
  const cap = (window as any).Capacitor;
  if (cap) {
    const isAndroid = /android/i.test(navigator.userAgent);
    return isAndroid ? 'http://10.0.2.2:8000/api' : `${backendUrl}/api`;
  }

  // Browser (web) — hit backend directly
  return `${backendUrl}/api`;
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ─── Request Interceptor — SYNCHRONOUS token read (no async, no race condition) ─
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken();
    console.log('Request Interceptor - URL:', config.url);
    console.log('Request Interceptor - Token:', token ? token.substring(0, 15) + '...' : 'null');
    if (token && token !== 'undefined' && token !== 'null') {
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor — handle 401 & token refresh ───────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      if (Array.isArray(detail)) {
        error.response.data.detail = detail
          .map((d: any) => {
            const field = d.loc ? d.loc[d.loc.length - 1] : 'field';
            return `${field}: ${d.msg}`;
          })
          .join(', ');
      } else if (typeof detail === 'object') {
        error.response.data.detail = JSON.stringify(detail);
      }
    }
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue subsequent calls while refresh is in progress
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            if (typeof originalRequest.headers.set === 'function') {
              originalRequest.headers.set('Authorization', `Bearer ${token}`);
            } else {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
          }
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenStorage.getRefreshToken();

      if (!refreshToken) {
        tokenStorage.clearTokens();
        isRefreshing = false;
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${getBaseURL()}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const { access_token, refresh_token: new_refresh } = res.data;
        tokenStorage.setTokens(access_token, new_refresh);

        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err);
        tokenStorage.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth API ────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data: { ic_number: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  completeProfile: (data: { full_name: string; email: string; mobile: string; avatar_url?: string }) =>
    api.put('/auth/complete-profile', data),
  changePassword: (data: { new_password: string }) =>
    api.put('/auth/change-password', data),
  refresh: (refresh_token: string) => api.post('/auth/refresh', { refresh_token }),
  forgotPassword: (data: { ic_number: string; method: string }) =>
    api.post('/auth/forgot-password', data),
  verifyOtp: (data: { ic_number: string; otp: string; new_password: string }) =>
    api.post('/auth/verify-otp', data),
  logout: () => api.post('/auth/logout'),
  requestOtp: (mobile: string) => api.post('/auth/register/request-otp', { mobile }),
  register: (data: any) => api.post('/auth/register', data),
  googleLogin: (idToken: string) => api.post('/auth/google', { id_token: idToken }),
};

// ─── Dashboard API ───────────────────────────────────────────────────────────
export const dashboardAPI = {
  admin: () => api.get('/dashboard/admin'),
  student: () => api.get('/dashboard/student'),
  attendanceTrend: () => api.get('/dashboard/charts/attendance-trend'),
  projectStatus: () => api.get('/dashboard/charts/project-status'),
  departmentChart: () => api.get('/dashboard/charts/department-distribution'),
};

// ─── Students API ────────────────────────────────────────────────────────────
export const studentsAPI = {
  list: (params?: Record<string, any>) => api.get('/students', { params }),
  get: (id: number) => api.get(`/students/${id}`),
  create: (data: any) => api.post('/students', data),
  update: (id: number, data: any) => api.put(`/students/${id}`, data),
  delete: (id: number) => api.delete(`/students/${id}`),
  bulkDelete: (ids: number[]) => api.request({ method: 'DELETE', url: '/students/bulk/delete', data: ids }),
  importCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/students/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  departments: () => api.get('/students/departments/list'),
  getSelfProfile: () => api.get('/students/profile/self'),
  updateSelfProfile: (data: any) => api.put('/students/profile/self', data),
};

// ─── Teams API ───────────────────────────────────────────────────────────────
export const teamsAPI = {
  list: (params?: Record<string, any>) => api.get('/teams', { params }),
  get: (id: number) => api.get(`/teams/${id}`),
  create: (data: any) => api.post('/teams', data),
  update: (id: number, data: any) => api.put(`/teams/${id}`, data),
  delete: (id: number) => api.delete(`/teams/${id}`),
  members: (id: number) => api.get(`/teams/${id}/members`),
  importCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/teams/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// ─── Projects API ────────────────────────────────────────────────────────────
export const projectsAPI = {
  list: (params?: Record<string, any>) => api.get('/projects', { params }),
  get: (id: number) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: number, data: any) => api.put(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  submissions: (projectId: number) => api.get(`/projects/${projectId}/submissions`),
  createSubmission: (projectId: number, data: any) =>
    api.post(`/projects/${projectId}/submissions`, data),
  reviewSubmission: (projectId: number, submissionId: number, data: any) =>
    api.put(`/projects/${projectId}/submissions/${submissionId}/review`, data),
};

// ─── Dynamic Forms API ───────────────────────────────────────────────────────
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
    api.put(`/forms/${formId}/responses/${responseId}/review`, null, {
      params: { status, admin_remarks: remarks },
    }),
};

// ─── Weekly Reports API ──────────────────────────────────────────────────────
export const weeklyReportsAPI = {
  list: (params?: Record<string, any>) => api.get('/weekly-reports', { params }),
  submit: (data: any) => api.post('/weekly-reports', data),
  review: (id: number, data: any) => api.put(`/weekly-reports/${id}/review`, data),
};

// ─── Announcements API ───────────────────────────────────────────────────────
export const announcementsAPI = {
  list: (params?: Record<string, any>) => api.get('/announcements', { params }),
  create: (data: any) => api.post('/announcements', data),
  update: (id: number, data: any) => api.put(`/announcements/${id}`, data),
  delete: (id: number) => api.delete(`/announcements/${id}`),
};

// ─── Meetings API ────────────────────────────────────────────────────────────
export const meetingsAPI = {
  list: (params?: Record<string, any>) => api.get('/meetings', { params }),
  get: (id: number) => api.get(`/meetings/${id}`),
  create: (data: any) => api.post('/meetings', data),
  update: (id: number, data: any) => api.put(`/meetings/${id}`, data),
  delete: (id: number) => api.delete(`/meetings/${id}`),
  invitees: (id: number) => api.get(`/meetings/${id}/invitees`),
};

// ─── Attendance API ──────────────────────────────────────────────────────────
export const attendanceAPI = {
  mark: (data: { method: string; photo_url?: string }) =>
    api.post('/attendance/mark', data),
  list: (params?: Record<string, any>) => api.get('/attendance', { params }),
  stats: () => api.get('/attendance/stats'),
  monthly: (params?: Record<string, any>) => api.get('/attendance/monthly', { params }),
  adminMark: (data: {
    student_id: number;
    date: string;
    status: string;
    method?: string;
  }) => api.post('/attendance/admin/mark', data),
};

// ─── Uploads API ─────────────────────────────────────────────────────────────
export const uploadsAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ─── Events API ──────────────────────────────────────────────────────────────
export const eventsAPI = {
  list: (params?: Record<string, any>) => api.get('/events', { params }),
  get: (id: number) => api.get(`/events/${id}`),
  create: (data: any) => api.post('/events', data),
  update: (id: number, data: any) => api.put(`/events/${id}`, data),
  delete: (id: number) => api.delete(`/events/${id}`),
  register: (id: number) => api.post(`/events/${id}/register`),
};

// ─── Notifications API ───────────────────────────────────────────────────────
export const notificationsAPI = {
  list: (params?: Record<string, any>) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: number) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// ─── Users API ──────────────────────────────────────────────────────────────
export const usersAPI = {
  list: (params?: Record<string, any>) => api.get('/users', { params }),
  get: (id: number) => api.get(`/users/${id}`),
  getRoles: () => api.get('/users/roles'),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  restore: (id: number) => api.put(`/users/${id}/restore`),
  /** role_name is a string like 'admin' or 'super_admin'; the backend resolves the DB id */
  createAdmin: (data: {
    ic_number: string;
    full_name: string;
    email: string;
    mobile: string;
    password: string;
    role_name: string;
  }) => api.post('/users/admin/create', data),
};


// ─── Attendance (extended) API ───────────────────────────────────────────────
export const attendanceExtAPI = {
  deleteRecord: (id: number) => api.delete(`/attendance/${id}`),
};

export default api;
