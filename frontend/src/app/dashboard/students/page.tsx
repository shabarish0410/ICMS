'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { studentsAPI, teamsAPI } from '@/services/api';
import { Search, Plus, Edit2, Trash2, GraduationCap, X, Loader2, Upload, Download, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ic_number: '', full_name: '', department: '', year: 1, semester: 1, mentor_name: '', password: '' });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);

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
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => studentsAPI.delete(id),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['students'] }); 
      toast.success('Deleted'); 
      setSelectedIds(prev => prev.filter(sid => sid !== deleteMutation.variables));
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => studentsAPI.bulkDelete(ids),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['students'] }); 
      toast.success(`Deleted ${selectedIds.length} students`);
      setSelectedIds([]); 
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Bulk delete failed'),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => studentsAPI.importCSV(file),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(`Imported ${res.data.success} students successfully.`);
      if (res.data.skipped > 0) toast.error(`${res.data.skipped} students skipped (already exist).`);
      setShowImportModal(false);
      setImportFile(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to import CSV/Excel file');
    },
  });

  const resetForm = () => { setForm({ ic_number: '', full_name: '', department: '', year: 1, semester: 1, mentor_name: '', password: '' }); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { 
      ic_number: form.ic_number, 
      full_name: form.full_name, 
      department: form.department, 
      year: Number(form.year), 
      semester: Number(form.semester), 
      mentor_name: form.mentor_name || undefined
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      payload.password = form.password;
      createMutation.mutate(payload);
    }
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) { toast.error("Please select a file first"); return; }
    importMutation.mutate(importFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setImportFile(e.dataTransfer.files[0]);
    }
  };

  const openEdit = (student: any) => {
    setEditing(student);
    setForm({
      ic_number: student.user?.ic_number || '',
      full_name: student.user?.full_name || '',
      department: student.department,
      year: student.year,
      semester: student.semester || 1,
      mentor_name: student.mentor_name || '',
      password: '',
    });
    setShowModal(true);
  };

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = students.map((s: any) => s.id);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const teams = teamsData?.data?.items || [];
  const students = data?.data?.items || [];
  const total = data?.data?.total || 0;
  
  const allSelected = students.length > 0 && selectedIds.length === students.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Student Management</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">{total} students registered</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowImportModal(true)} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import CSV/Excel
          </button>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Student
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between"
          >
            <span className="text-red-500 font-semibold text-sm ml-2">{selectedIds.length} students selected</span>
            <button 
              onClick={() => { if (confirm(`Delete ${selectedIds.length} students?`)) bulkDeleteMutation.mutate(selectedIds); }}
              disabled={bulkDeleteMutation.isPending}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Bulk Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or IC number..." className="input-field pl-10" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 overflow-x-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-dark-900/50 flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        )}
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-850">
              <th className="px-4 py-3 text-left w-[40px]">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-dark-300 text-primary-500 focus:ring-primary-500"
                  checked={allSelected}
                  ref={(input) => { if (input) input.indeterminate = someSelected; }}
                  onChange={handleToggleSelectAll}
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">IC Number</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Department</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Year</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Semester</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Team</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-dark-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s: any, i: number) => (
              <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className={`border-b border-dark-100 dark:border-dark-800 transition-colors ${selectedIds.includes(s.id) ? 'bg-primary-50 dark:bg-primary-500/10' : 'hover:bg-dark-50 dark:hover:bg-dark-850'}`}
              >
                <td className="px-4 py-3">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-dark-300 text-primary-500 focus:ring-primary-500"
                    checked={selectedIds.includes(s.id)}
                    onChange={() => handleToggleSelect(s.id)}
                  />
                </td>
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
                <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">Semester {s.semester || '—'}</td>
                <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">{s.team?.name || '—'}</td>
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
            {students.length === 0 && !isLoading && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-dark-400">
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

      {/* Edit/Create Modal */}
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
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Semester</label>
                  <select value={form.semester} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })} className="input-field">
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">Import Students</h3>
              <button onClick={() => setShowImportModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-dark-500 mb-4">
              Upload a CSV, Excel, or PDF file. Required columns: 
              <span className="font-mono text-xs bg-dark-100 dark:bg-dark-700 px-1 py-0.5 rounded ml-1">ic_number</span>, 
              <span className="font-mono text-xs bg-dark-100 dark:bg-dark-700 px-1 py-0.5 rounded ml-1">full_name</span>, 
              <span className="font-mono text-xs bg-dark-100 dark:bg-dark-700 px-1 py-0.5 rounded ml-1">department</span>, 
              <span className="font-mono text-xs bg-dark-100 dark:bg-dark-700 px-1 py-0.5 rounded ml-1">year</span>.
            </p>

            <form onSubmit={handleImportSubmit}>
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDragging 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 scale-[1.02]' 
                    : 'border-dark-300 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-800'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/pdf"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full"
                >
                  <Upload className={`w-10 h-10 mb-3 transition-colors ${isDragging ? 'text-primary-500' : 'text-dark-400'}`} />
                  <span className="text-sm font-semibold text-primary-500">
                    {isDragging ? 'Drop file here' : 'Click to browse or drag and drop'}
                  </span>
                  <span className="text-xs text-dark-400 mt-2">
                    {importFile ? (
                      <span className="text-primary-600 dark:text-primary-400 font-semibold bg-primary-50 dark:bg-primary-500/10 px-2 py-1 rounded">
                        {importFile.name}
                      </span>
                    ) : (
                      'CSV, Excel, or PDF files'
                    )}
                  </span>
                </button>
              </div>

              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowImportModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={!importFile || importMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload Data
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
