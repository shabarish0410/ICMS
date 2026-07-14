'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { usersAPI } from '@/services/api';
import {
  Shield, UserPlus, Search, MoreVertical, CheckCircle,
  XCircle, Edit2, Trash2, X, Loader2, Eye, EyeOff,
  Mail, Phone, CreditCard, Lock, RefreshCw, Crown, Users, Shirt, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface AdminUser {
  id: number;
  ic_number: string;
  full_name: string;
  email?: string;
  mobile?: string;
  is_active: boolean;
  created_at?: string;
  last_login?: string;
  role?: { id: number; name: string; description?: string };
}

interface Role {
  id: number;
  name: string;
  description?: string;
}

// Role badge — renders different colours per role name
function RoleBadge({ role }: { role?: { name: string } }) {
  if (!role) return <span className="text-xs text-dark-400">—</span>;
  if (role.name === 'super_admin')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/30">
        <Crown className="w-3 h-3" /> Super Admin
      </span>
    );
  if (role.name === 'admin')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border bg-violet-500/10 text-violet-400 border-violet-500/30">
        <Shield className="w-3 h-3" /> Admin
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border bg-blue-500/10 text-blue-400 border-blue-500/30">
      <Users className="w-3 h-3" /> {role.name}
    </span>
  );
}

// A nice role-colour helper for the button grid
function roleButtonStyle(roleName: string, selected: boolean) {
  if (!selected)
    return 'border-dark-200 dark:border-dark-700 text-dark-500 hover:bg-dark-50 dark:hover:bg-dark-850';
  if (roleName === 'super_admin') return 'border-amber-500 text-amber-400 bg-amber-500/10';
  if (roleName === 'admin')       return 'border-violet-500 text-violet-400 bg-violet-500/10';
  return 'border-primary-500 text-primary-400 bg-primary-500/10';
}

const EMPTY_FORM = {
  ic_number: '', full_name: '', email: '', mobile: '', password: '', role_name: 'admin',
};

export default function AdminsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [menuOpen, setMenuOpen]         = useState<number | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [editUser, setEditUser]         = useState<AdminUser | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const [showPw, setShowPw]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  // ── Fetch roles dynamically from the DB ────────────────────────────────────
  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => usersAPI.getRoles(),
    staleTime: 5 * 60 * 1000,
  });
  // Only show admin-level roles in the UI (filter out 'student')
  const adminRoles: Role[] = (rolesData?.data ?? []).filter(
    (r: Role) => r.name !== 'student',
  );

  // ── Debounce the search input ──────────────────────────────────────────────
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // ── Fetch admin & super_admin users ───────────────────────────────────────
  const { data: adminData, isLoading: loadingAdmins } = useQuery({
    queryKey: ['admin-users', debouncedSearch],
    queryFn: () => usersAPI.list({ role: 'admin', search: debouncedSearch, size: 100 }),
    placeholderData: keepPreviousData,
  });
  const { data: superData, isLoading: loadingSuper } = useQuery({
    queryKey: ['super-admin-users', debouncedSearch],
    queryFn: () => usersAPI.list({ role: 'super_admin', search: debouncedSearch, size: 100 }),
    placeholderData: keepPreviousData,
  });

  const isLoading = loadingAdmins || loadingSuper;
  const admins: AdminUser[] = [
    ...(superData?.data?.items ?? []),
    ...(adminData?.data?.items ?? []),
  ];

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    qc.invalidateQueries({ queryKey: ['super-admin-users'] });
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d: typeof EMPTY_FORM) => usersAPI.createAdmin(d),
    onSuccess: () => {
      invalidateAll();
      toast.success('Admin user created successfully!');
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => usersAPI.update(id, data),
    onSuccess: () => {
      invalidateAll();
      toast.success('User updated!');
      setEditUser(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to update'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => usersAPI.delete(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('User deactivated');
      setConfirmDelete(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to deactivate'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => usersAPI.restore(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('User restored');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to restore'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCreate = () => {
    const { ic_number, full_name, email, mobile, password, role_name } = form;
    if (!ic_number || !full_name || !email || !mobile || !password || !role_name) {
      toast.error('All fields are required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    createMutation.mutate(form);
  };

  const handleUpdate = () => {
    if (!editUser) return;
    // Find the role_id for the selected role_name from our fetched roles
    const matchedRole = adminRoles.find((r) => r.name === form.role_name);
    if (!matchedRole) { toast.error('Invalid role selected'); return; }
    updateMutation.mutate({
      id: editUser.id,
      data: { full_name: form.full_name, email: form.email, mobile: form.mobile, role_id: matchedRole.id },
    });
  };

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setForm({
      ic_number: u.ic_number,
      full_name: u.full_name,
      email: u.email ?? '',
      mobile: u.mobile ?? '',
      password: '',
      role_name: u.role?.name ?? 'admin',
    });
    setMenuOpen(null);
  };

  const closeForm = () => { setShowForm(false); setEditUser(null); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
        <Link
          href="/dashboard/admins/face-management"
          className="flex items-center gap-3 p-4 bg-brand-cyan/10 border border-brand-cyan/20 rounded-2xl hover:bg-brand-cyan/20 transition-colors group"
        >
          <div className="p-2.5 bg-brand-cyan/10 rounded-xl">
            <Shield className="w-5 h-5 text-brand-cyan" />
          </div>
          <div className="flex-1">
            <p className="text-brand-cyan font-semibold text-sm">Face Registration Dashboard</p>
            <p className="text-dark-600 dark:text-dark-400 text-xs mt-0.5">Monitor all students' face registration status</p>
          </div>
          <ArrowRight className="w-4 h-4 text-brand-cyan group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          href="/dashboard/admins/uniform-management"
          className="flex items-center gap-3 p-4 bg-brand-indigo/10 border border-brand-indigo/20 rounded-2xl hover:bg-brand-indigo/20 transition-colors group"
        >
          <div className="p-2.5 bg-brand-indigo/10 rounded-xl">
            <Shirt className="w-5 h-5 text-brand-indigo" />
          </div>
          <div className="flex-1">
            <p className="text-brand-indigo font-semibold text-sm">Uniform Management</p>
            <p className="text-dark-600 dark:text-dark-400 text-xs mt-0.5">Upload reference uniform images for AI detection</p>
          </div>
          <ArrowRight className="w-4 h-4 text-brand-indigo group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary-500" /> Admin Management
          </h1>
          <p className="text-dark-500 text-sm mt-0.5">
            Manage administrator accounts and their permissions
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm({ ...EMPTY_FORM }); }}
          className="btn-primary flex items-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-xl"
        >
          <UserPlus className="w-4 h-4" /> Add Admin
        </button>
      </div>

      {/* Premium Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        {[
          { label: 'Total Admins', value: admins.length, color: 'text-dark-900 dark:text-white', border: 'border-t-brand-indigo', bg: 'bg-brand-indigo/10' },
          { label: 'Active', value: admins.filter((a) => a.is_active).length, color: 'text-brand-emerald', border: 'border-t-brand-emerald', bg: 'bg-brand-emerald/10' },
          { label: 'Inactive', value: admins.filter((a) => !a.is_active).length, color: 'text-brand-red', border: 'border-t-brand-red', bg: 'bg-brand-red/10' },
          { label: 'Super Admins', value: admins.filter((a) => a.role?.name === 'super_admin').length, color: 'text-brand-amber', border: 'border-t-brand-amber', bg: 'bg-brand-amber/10' },
        ].map((s) => (
          <div key={s.label} className={`stat-card border-t-[3px] ${s.border}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-dark-500 dark:text-dark-400 uppercase tracking-widest">{s.label}</p>
            </div>
            <p className={`text-5xl font-heading font-extrabold mt-2 tracking-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-dark-200 dark:border-dark-700 p-4 shadow-sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-dark-200 dark:border-dark-700 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-dark-200 dark:border-dark-700 bg-dark-50/50 dark:bg-dark-850/50">
                  {['Name', 'IC Number', 'Mobile', 'Role', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-dark-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admins.map((u) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-dark-100 dark:border-dark-800 hover:bg-dark-50/50 dark:hover:bg-dark-850/50 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-indigo/10 flex items-center justify-center text-brand-indigo text-sm font-bold flex-shrink-0 border border-brand-indigo/20">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-dark-900 dark:text-white">{u.full_name}</p>
                          <p className="text-xs text-dark-500 dark:text-dark-400 truncate max-w-[180px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-mono text-dark-600 dark:text-dark-300">{u.ic_number}</td>
                    <td className="px-5 py-3.5 text-sm text-dark-500">{u.mobile ?? '—'}</td>
                    <td className="px-5 py-3.5"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3.5">
                      {u.is_active ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
                          <XCircle className="w-3.5 h-3.5" /> Inactive
                        </span>
                      )}
                    </td>
                    {/* Actions kebab */}
                    <td className="px-5 py-3.5">
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === u.id ? null : u.id)}
                          className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors text-dark-400"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {menuOpen === u.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              className="absolute right-0 top-8 z-50 bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 shadow-2xl py-1 min-w-[160px]"
                            >
                              <button
                                onClick={() => openEdit(u)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-700 dark:text-dark-200 hover:bg-dark-50 dark:hover:bg-dark-700"
                              >
                                <Edit2 className="w-4 h-4 text-primary-500" /> Edit
                              </button>
                              {u.is_active ? (
                                <button
                                  onClick={() => { setConfirmDelete(u); setMenuOpen(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 className="w-4 h-4" /> Deactivate
                                </button>
                              ) : (
                                <button
                                  onClick={() => { restoreMutation.mutate(u.id); setMenuOpen(null); }}
                                  disabled={restoreMutation.isPending}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                >
                                  <RefreshCw className="w-4 h-4" /> Restore
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {admins.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-dark-400">
                      <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No admin users found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      <AnimatePresence>
        {(showForm || editUser) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-200 dark:border-dark-700 shadow-2xl"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-dark-100 dark:border-dark-700">
                <h3 className="font-bold text-dark-900 dark:text-white flex items-center gap-2 text-base">
                  {editUser ? <Edit2 className="w-4 h-4 text-primary-500" /> : <UserPlus className="w-4 h-4 text-primary-500" />}
                  {editUser ? 'Edit Admin User' : 'Create New Admin'}
                </h3>
                <button onClick={closeForm} className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                  <X className="w-5 h-5 text-dark-400" />
                </button>
              </div>

              <div className="space-y-3.5">

                {/* Role selector — dynamic from DB */}
                <div>
                  <label className="text-xs font-semibold text-dark-500 block mb-1.5">
                    Role {adminRoles.length === 0 && <span className="text-amber-500">(loading…)</span>}
                  </label>
                  {adminRoles.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {adminRoles.map((r) => (
                        <button
                          key={r.name}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, role_name: r.name }))}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${roleButtonStyle(r.name, form.role_name === r.name)}`}
                        >
                          {r.name === 'super_admin' ? '👑 Super Admin' : r.name === 'admin' ? '🛡️ Admin' : r.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-10 bg-dark-100 dark:bg-dark-700 rounded-xl animate-pulse" />
                  )}
                  {form.role_name && (
                    <p className="text-[11px] text-dark-400 mt-1 ml-1">
                      Selected: <strong className="text-dark-600 dark:text-dark-300">{form.role_name}</strong>
                    </p>
                  )}
                </div>

                {/* Full Name */}
                <div>
                  <label className="text-xs font-semibold text-dark-500 block mb-1">Full Name</label>
                  <input
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="e.g. Ahmad Zulkifli"
                    className="input-field py-2 text-sm"
                  />
                </div>

                {/* IC Number — create only */}
                {!editUser && (
                  <div>
                    <label className="text-xs font-semibold text-dark-500 block mb-1">IC Number</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                      <input
                        value={form.ic_number}
                        onChange={(e) => setForm((f) => ({ ...f, ic_number: e.target.value }))}
                        placeholder="e.g. 990101141234"
                        className="input-field py-2 text-sm pl-9"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-dark-500 block mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="admin@spark.edu.my"
                      className="input-field py-2 text-sm pl-9"
                    />
                  </div>
                </div>

                {/* Mobile */}
                <div>
                  <label className="text-xs font-semibold text-dark-500 block mb-1">Mobile</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                      value={form.mobile}
                      onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                      placeholder="+60123456789"
                      className="input-field py-2 text-sm pl-9"
                    />
                  </div>
                </div>

                {/* Password — create only */}
                {!editUser && (
                  <div>
                    <label className="text-xs font-semibold text-dark-500 block mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="Min. 6 characters"
                        className="input-field py-2 text-sm pl-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-5 pt-4 border-t border-dark-100 dark:border-dark-700">
                <button
                  onClick={closeForm}
                  className="flex-1 py-2.5 rounded-xl border border-dark-200 dark:border-dark-700 text-dark-600 dark:text-dark-300 text-sm font-semibold hover:bg-dark-50 dark:hover:bg-dark-850 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editUser ? handleUpdate : handleCreate}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 btn-primary py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending)
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : editUser ? 'Save Changes' : 'Create Admin'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm Deactivate ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-sm border border-dark-200 dark:border-dark-700 shadow-2xl text-center"
            >
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="font-bold text-dark-900 dark:text-white mb-1">Deactivate Admin?</h3>
              <p className="text-sm text-dark-500 mb-5">
                <strong>{confirmDelete.full_name}</strong> will lose dashboard access. Their data is preserved and can be restored later.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-dark-200 dark:border-dark-700 text-sm font-semibold text-dark-600 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-850"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deactivateMutation.mutate(confirmDelete.id)}
                  disabled={deactivateMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {deactivateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deactivate'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
