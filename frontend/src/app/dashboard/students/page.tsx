'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { studentsAPI, teamsAPI } from '@/services/api';
import { Search, Plus, Edit2, Trash2, GraduationCap, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ic_number: '', full_name: '', department: '', year: 1, mentor_name: '', team_id: '', password: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, search],
    queryFn: () => studentsAPI.list({ page, size: 20, search }),
  });
  const { data: teamsData } = useQuery({ queryKey: ['teams-list'], queryFn: () => teamsAPI.list({ size: 100 }) });

  const createMutation = useMutation({
    mutationFn: (data: any) => studentsAPI.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['students'] }); toast.success('Student added!'); setShowModal(false); resetForm(); },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => studentsAPI.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['students'] }); toast.success('Updated!'); setShowModal(false); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => studentsAPI.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['students'] }); toast.success('Deleted'); },
  });

  const resetForm = () => { setForm({ ic_number: '', full_name: '', department: '', year: 1, mentor_name: '', team_id: '', password: '' }); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { 
      ic_number: form.ic_number, 
      full_name: form.full_name, 
      department: form.department, 
      year: Number(form.year), 
      mentor_name: form.mentor_name || undefined, 
      team_id: form.team_id ? Number(form.team_id) : undefined 
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      payload.password = form.password;
      createMutation.mutate(payload);
    }
  };

  const openEdit = (student: any) => {
    setEditing(student);
    setForm({
      ic_number: student.user?.ic_number || '',
      full_name: student.user?.full_name || '',
      department: student.department,
      year: student.year,
      mentor_name: student.mentor_name || '',
      team_id: student.team_id?.toString() || '',
      password: '',
    });
    setShowModal(true);
  };

  const teams = teamsData?.data?.items || [];
  const students = data?.data?.items || [];
  const total = data?.data?.total || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Student Management</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">{total} students registered</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Student
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or IC number..." className="input-field pl-10" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-850">
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">IC Number</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Department</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Year</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Team</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Mentor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s: any, i: number) => (
              <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="border-b border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-850 transition-colors"
              >
                <td className="px-4 py-3 text-sm font-mono text-primary-600 dark:text-primary-400">{s.user?.ic_number}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                      {s.user?.full_name?.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-dark-900 dark:text-white">{s.user?.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">{s.department}</td>
                <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">Year {s.year}</td>
                <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">{s.team?.name || '—'}</td>
                <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">{s.mentor_name || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-400 hover:text-primary-500">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm('Delete this student?')) deleteMutation.mutate(s.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-dark-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-dark-400">
                <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                No students found.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.data?.pages && data.data.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: data.data.pages || 0 }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`px-3 py-1.5 rounded-lg text-sm ${page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 text-dark-600 hover:bg-dark-100'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">{editing ? 'Edit Student' : 'Add New Student'}</h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editing && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">IC Number</label>
                    <input value={form.ic_number} onChange={(e) => setForm({ ...form, ic_number: e.target.value })}
                      placeholder="IC2024011" required className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Password</label>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Enter password" required className="input-field" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Full Name</label>
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Department</label>
                  <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                    required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Year</label>
                  <select value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className="input-field">
                    {[1,2,3,4,5].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Team</label>
                  <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} className="input-field">
                    <option value="">None</option>
                    {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Mentor</label>
                  <input value={form.mentor_name} onChange={(e) => setForm({ ...form, mentor_name: e.target.value })} className="input-field" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary flex-1">
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editing ? 'Update' : 'Add Student'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
