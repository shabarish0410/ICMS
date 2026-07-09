'use client';

import { useState, useEffect, useCallback } from 'react';
import { faceAPI } from '@/services/api';
import {
  Shield, Search, RefreshCw, CheckCircle, XCircle,
  AlertCircle, ChevronLeft, ChevronRight, Filter, Users, Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface StudentFaceStatus {
  id: number;
  face_registered: boolean;
  face_registered_at: string | null;
  department: string;
  user: {
    id: number;
    ic_number: string;
    full_name: string;
    email: string;
  };
}

export default function AdminFaceManagementPage() {
  const [students, setStudents] = useState<StudentFaceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'registered' | 'not_registered'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [resetting, setResetting] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState<StudentFaceStatus | null>(null);
  const size = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await faceAPI.adminAllStatus({
        department: filterDept || undefined,
        page,
        size,
      });
      setStudents(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      toast.error('Failed to load face registration data.');
    } finally {
      setLoading(false);
    }
  }, [filterDept, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReset = async (student: StudentFaceStatus) => {
    setResetting(student.id);
    try {
      await faceAPI.reset(student.id);
      toast.success(`Face registration reset for ${student.user.full_name}`);
      setConfirmReset(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to reset face registration.');
    } finally {
      setResetting(null);
    }
  };

  // Filter client-side by search and status
  const filtered = students.filter((s) => {
    const matchesSearch =
      !search ||
      s.user.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.user.ic_number.toLowerCase().includes(search.toLowerCase()) ||
      s.department.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'registered' && s.face_registered) ||
      (filterStatus === 'not_registered' && !s.face_registered);

    return matchesSearch && matchesStatus;
  });

  const registeredCount = students.filter((s) => s.face_registered).length;
  const notRegisteredCount = students.filter((s) => !s.face_registered).length;

  const departments = [...new Set(students.map((s) => s.department))].filter(Boolean).sort();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Face Registration Management</h1>
              <p className="text-slate-400 text-sm">Monitor and manage student face registrations</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl">
              <Users className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Students</p>
              <p className="text-white text-2xl font-bold">{total}</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Face Registered</p>
              <p className="text-emerald-400 text-2xl font-bold">{registeredCount}</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Not Registered</p>
              <p className="text-amber-400 text-2xl font-bold">{notRegisteredCount}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, IC number, department..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <select
            value={filterDept}
            onChange={(e) => { setFilterDept(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500/50"
          >
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <div className="flex gap-2">
            {(['all', 'registered', 'not_registered'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  filterStatus === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:text-white border border-slate-600/50'
                }`}
              >
                {f === 'all' ? 'All' : f === 'registered' ? '✓ Registered' : '✗ Not Registered'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No students found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-6 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Student</th>
                    <th className="text-left px-6 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">IC Number</th>
                    <th className="text-left px-6 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Department</th>
                    <th className="text-left px-6 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Face Status</th>
                    <th className="text-left px-6 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Registered On</th>
                    <th className="text-left px-6 py-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {filtered.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-white font-medium text-sm">{student.user.full_name}</p>
                          <p className="text-slate-400 text-xs">{student.user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-300 font-mono text-sm">{student.user.ic_number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-300 text-sm">{student.department}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1.5 w-fit px-3 py-1 rounded-full text-xs font-semibold ${
                          student.face_registered
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {student.face_registered ? (
                            <><CheckCircle className="w-3 h-3" /> Registered</>
                          ) : (
                            <><XCircle className="w-3 h-3" /> Not Registered</>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-400 text-sm">
                          {student.face_registered_at
                            ? new Date(student.face_registered_at).toLocaleDateString('en-IN')
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {student.face_registered && (
                          <button
                            onClick={() => setConfirmReset(student)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl text-xs font-medium transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                            Reset Face
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-slate-400 text-sm">
          <span>
            Showing {filtered.length} of {total} students
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 hover:bg-slate-700 rounded-xl disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1.5 bg-slate-700/50 rounded-xl text-white">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={students.length < size}
              className="p-2 hover:bg-slate-700 rounded-xl disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Reset Modal */}
      {confirmReset && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Reset Face Registration</h3>
                <p className="text-slate-400 text-sm">
                  Are you sure you want to reset the face registration for{' '}
                  <strong className="text-white">{confirmReset.user.full_name}</strong>?
                  They will need to re-register their face to use Face Attendance.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReset(null)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReset(confirmReset)}
                disabled={resetting === confirmReset.id}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl transition-all text-sm font-semibold"
              >
                {resetting === confirmReset.id ? 'Resetting...' : 'Reset Face'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
