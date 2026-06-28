'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { teamsAPI, studentsAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Plus, Edit2, Trash2, Users2, X, Loader2, ArrowRight, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeamsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', department: '', mentor_name: '', student_ids: [] as number[] });
  
  const { data: studentsData } = useQuery({ 
    queryKey: ['students-all'], 
    queryFn: () => studentsAPI.list({ size: 1000 }) 
  });
  const allStudents = studentsData?.data?.items || [];
  const [importFile, setImportFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({ 
    queryKey: ['teams'], 
    queryFn: () => teamsAPI.list({ size: 100 }) 
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => teamsAPI.create(d),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['teams'] }); 
      toast.success('Team created!'); 
      setShowModal(false); 
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to create team'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => teamsAPI.update(id, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['teams'] }); 
      toast.success('Team updated successfully!'); 
      setShowModal(false); 
    },
    onError: (e: any) => toast.error('Failed to update team'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => teamsAPI.delete(id),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['teams'] }); 
      toast.success('Team deleted successfully'); 
    },
    onError: (e: any) => toast.error('Failed to delete team'),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => teamsAPI.importCSV(file),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success(`Imported ${res.data.success} teams successfully.`);
      if (res.data.skipped > 0) toast.error(`${res.data.skipped} teams skipped (already exist).`);
      setShowImportModal(false);
      setImportFile(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to import CSV/Excel file');
    },
  });

  const openEdit = (t: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering route details click
    setEditing(t); 
    teamsAPI.members(t.id).then((res) => {
      const memberIds = res.data.map((m: any) => m.id);
      setForm(prev => ({ ...prev, student_ids: memberIds }));
    });
    setForm({ name: t.name, description: t.description || '', department: t.department || '', mentor_name: t.mentor_name || '', student_ids: [] }); 
    setShowModal(true);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering route details click
    if (confirm('Are you sure you want to delete this team? All student assignments will be cleared.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
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

  const teams = [...(data?.data?.items || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Teams</h1>
          <p className="text-dark-500 mt-1">Manage Innovation Center project groups and student allocations</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <button onClick={() => setShowImportModal(true)} className="btn-secondary flex items-center gap-2">
              <Upload className="w-4 h-4" /> Import CSV/Excel
            </button>
            <button 
              onClick={() => { setEditing(null); setForm({ name: '', description: '', department: '', mentor_name: '', student_ids: [] }); setShowModal(true); }} 
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Team
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {teams.map((t: any, i: number) => (
            <motion.div 
              key={t.id} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.05 }}
              onClick={() => router.push(`/dashboard/teams/${t.id}`)}
              className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
                    <Users2 className="w-5 h-5 text-white" />
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button 
                        onClick={(e) => openEdit(t, e)} 
                        className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-400 hover:text-primary-500"
                        title="Edit Team Info"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(t.id, e)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-dark-400 hover:text-red-500"
                        title="Delete Team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                
                <h3 className="font-semibold text-dark-900 dark:text-white group-hover:text-primary-500 transition-colors">{t.name}</h3>
                <p className="text-xs text-dark-500 mt-1 line-clamp-2 min-h-[32px]">{t.description || 'No team description.'}</p>
                
                <div className="flex items-center gap-3 mt-4 text-xs font-semibold text-dark-400">
                  {t.department && (
                    <span className="px-2.5 py-0.5 bg-dark-100 dark:bg-dark-750 text-dark-600 dark:text-dark-350 rounded-full">
                      {t.department}
                    </span>
                  )}
                  <span>{t.member_count || 0} members</span>
                </div>
                {t.mentor_name && <p className="text-xs text-dark-450 mt-2 font-medium">Mentor: {t.mentor_name}</p>}
              </div>

              <div className="flex items-center justify-between mt-5 pt-3 border-t border-dark-100 dark:border-dark-750/60 text-[10px] font-bold text-dark-400 group-hover:text-primary-500 transition-colors">
                <span>VIEW TEAM DETAILS</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
          {teams.length === 0 && (
            <div className="col-span-full py-20 text-center text-dark-400 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-2xl">
              <Users2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No teams created yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
                <h3 className="text-lg font-bold text-dark-900 dark:text-white">{editing ? 'Edit Team' : 'Create Team'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Team Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="input-field" placeholder="e.g. Team Alpha" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" rows={3} placeholder="Describe the team focus area..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Department</label>
                    <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="input-field text-sm" placeholder="e.g. Computer Science" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Mentor Name</label>
                    <input value={form.mentor_name} onChange={(e) => setForm({ ...form, mentor_name: e.target.value })} className="input-field text-sm" placeholder="e.g. Dr. John" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Students</label>
                  <select 
                    multiple 
                    value={form.student_ids.map(String)} 
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                      setForm({ ...form, student_ids: selected });
                    }} 
                    className="input-field h-32"
                  >
                    {allStudents.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.user?.full_name} ({s.user?.ic_number})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-dark-400 mt-1">Hold Ctrl/Cmd to select multiple students.</p>
                </div>
                <div className="flex gap-3 pt-4 border-t border-dark-100 dark:border-dark-700">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">
                    {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editing ? 'Update Team' : 'Create Team'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-200 dark:border-dark-700 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-dark-900 dark:text-white">Import Teams</h3>
                <button onClick={() => setShowImportModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-dark-500 mb-4">
                Upload a CSV, Excel, or PDF file. Required columns: 
                <span className="font-mono text-xs bg-dark-100 dark:bg-dark-700 px-1 py-0.5 rounded ml-1">name</span>. 
                Optional: 
                <span className="font-mono text-xs bg-dark-100 dark:bg-dark-700 px-1 py-0.5 rounded ml-1">description</span>, 
                <span className="font-mono text-xs bg-dark-100 dark:bg-dark-700 px-1 py-0.5 rounded ml-1">department</span>, 
                <span className="font-mono text-xs bg-dark-100 dark:bg-dark-700 px-1 py-0.5 rounded ml-1">mentor_name</span>.
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
      </AnimatePresence>

    </div>
  );
}
