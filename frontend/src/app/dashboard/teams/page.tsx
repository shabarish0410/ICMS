'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { teamsAPI, studentsAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Plus, Edit2, Trash2, Users2, X, Loader2, ArrowRight, Upload, Search, Check, AlertCircle } from 'lucide-react';
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
  
  const [importFile, setImportFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({ 
    queryKey: ['teams'], 
    queryFn: () => teamsAPI.list({ size: 100 }) 
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => teamsAPI.create(d),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['teams'] }); 
      toast.success('Team created successfully!'); 
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
    e.stopPropagation();
    setEditing(t); 
    setShowModal(true);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this team? All student assignments will be cleared.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleModalSubmit = (formData: any) => {
    if (editing) updateMutation.mutate({ id: editing.id, data: formData });
    else createMutation.mutate(formData);
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
              onClick={() => { setEditing(null); setShowModal(true); }} 
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

      {/* Edit/Create Modal - Enhanced UI */}
      <AnimatePresence>
        {showModal && (
          <TeamModal 
            editing={editing} 
            onClose={() => setShowModal(false)} 
            onSubmit={handleModalSubmit} 
            isSubmitting={createMutation.isPending || updateMutation.isPending} 
          />
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

// ─── Team Modal with Searchable Student Selection ─────────────────────────────

function TeamModal({ editing, onClose, onSubmit, isSubmitting }: any) {
  const MAX_STUDENTS = 6;
  
  const [form, setForm] = useState({ name: '', description: '', department: '', mentor_name: '' });
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);
  const [initialLoading, setInitialLoading] = useState(!!editing);
  
  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch departments for filter
  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => studentsAPI.departments(),
  });
  const departments = deptData?.data || [];

  // Fetch available students
  const { data: availableData, isLoading: isLoadingAvailable } = useQuery({
    queryKey: ['students-available', searchTerm, departmentFilter],
    queryFn: () => studentsAPI.available({ search: searchTerm, department: departmentFilter, size: 50, exclude_assigned: true }),
  });
  
  const availableStudents = availableData?.data?.items || [];

  // Load existing data if editing
  useEffect(() => {
    if (editing) {
      setForm({ 
        name: editing.name || '', 
        description: editing.description || '', 
        department: editing.department || '', 
        mentor_name: editing.mentor_name || '' 
      });
      teamsAPI.members(editing.id).then(res => {
        setSelectedStudents(res.data);
        setInitialLoading(false);
      }).catch(() => {
        toast.error("Failed to load team members");
        setInitialLoading(false);
      });
    }
  }, [editing]);

  const toggleStudent = (student: any) => {
    const isSelected = selectedStudents.some(s => s.id === student.id);
    if (isSelected) {
      setSelectedStudents(prev => prev.filter(s => s.id !== student.id));
    } else {
      if (selectedStudents.length >= MAX_STUDENTS) {
        toast.error(`Maximum ${MAX_STUDENTS} students allowed per team.`);
        return;
      }
      setSelectedStudents(prev => [...prev, student]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, student_ids: selectedStudents.map(s => s.id) });
  };

  // The displayed students should be a mix of the API results and the currently selected students
  // so that if a selected student is filtered out by search, they are still "available" to be toggled off
  // Actually, we show selected students in the right panel anyway, so the left panel only needs to show available + search results.
  // BUT we must ensure students already in the team (during edit) appear correctly if searched.
  const displayStudents = [...availableStudents];
  // Add any selected students that are missing from the available list to display them (optional, but good UX)
  selectedStudents.forEach(selected => {
    if (!displayStudents.find(s => s.id === selected.id)) {
      displayStudents.push(selected);
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-5xl border border-dark-200 dark:border-dark-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-5 border-b border-dark-100 dark:border-dark-700 bg-dark-50/50 dark:bg-dark-800/50 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-dark-900 dark:text-white">
              {editing ? 'Edit Team' : 'Create Team'}
            </h3>
            <p className="text-xs text-dark-500 mt-1">Fill in the details and assemble your team members.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-dark-200 dark:hover:bg-dark-700 transition-colors">
            <X className="w-5 h-5 text-dark-500" />
          </button>
        </div>

        {initialLoading ? (
          <div className="flex-1 p-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-4" />
            <p className="text-dark-500 font-medium">Loading team data...</p>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Team Details & Available Students */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Team Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Team Name *</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="input-field" placeholder="e.g. Innovators Club" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Description</label>
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" rows={2} placeholder="Briefly describe the team's objective..." />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Department</label>
                    <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="input-field" placeholder="e.g. Computer Science" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Mentor Name</label>
                    <input value={form.mentor_name} onChange={(e) => setForm({ ...form, mentor_name: e.target.value })} className="input-field" placeholder="e.g. Dr. Smith" />
                  </div>
                </div>

                <hr className="border-dark-100 dark:border-dark-700" />

                {/* Student Selection Section */}
                <div>
                  <h4 className="text-base font-bold text-dark-900 dark:text-white mb-3">Student Selection</h4>
                  
                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                      <input 
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search by Name, IC Number, Email..."
                        className="input-field pl-9"
                      />
                    </div>
                    <select 
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      className="input-field sm:w-48"
                    >
                      <option value="">All Departments</option>
                      {departments.map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Available Students Grid */}
                  <div className="border border-dark-200 dark:border-dark-700 rounded-xl bg-dark-50 dark:bg-dark-900/50 p-2 h-[350px] overflow-y-auto">
                    {isLoadingAvailable ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="h-20 bg-dark-200 dark:bg-dark-800 rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : displayStudents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-dark-400">
                        <Users2 className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm">No students found matching your search.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {displayStudents.map((s: any) => {
                          const isSelected = selectedStudents.some(sel => sel.id === s.id);
                          const isMaxReached = selectedStudents.length >= MAX_STUDENTS;
                          
                          return (
                            <div 
                              key={s.id} 
                              className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                                isSelected 
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                                  : 'border-white dark:border-dark-800 bg-white dark:bg-dark-800 hover:border-dark-300 dark:hover:border-dark-600 shadow-sm'
                              }`}
                            >
                              <div>
                                <h5 className="font-semibold text-sm text-dark-900 dark:text-white truncate">{s.user?.full_name}</h5>
                                <div className="text-xs text-dark-500 mt-0.5 font-mono">{s.user?.ic_number}</div>
                                <div className="flex items-center gap-2 mt-2 text-[10px] font-medium text-dark-400">
                                  <span className="bg-dark-100 dark:bg-dark-700 px-1.5 py-0.5 rounded">{s.department || 'No Dept'}</span>
                                  {s.year && <span>Year {s.year}</span>}
                                  {s.section && <span>Sec {s.section}</span>}
                                </div>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => toggleStudent(s)}
                                disabled={!isSelected && isMaxReached}
                                className={`mt-3 py-1.5 px-3 rounded-lg text-xs font-bold w-full transition-colors flex items-center justify-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400'
                                    : (!isSelected && isMaxReached)
                                      ? 'bg-dark-100 dark:bg-dark-800 text-dark-400 cursor-not-allowed'
                                      : 'bg-dark-900 dark:bg-white text-white dark:text-dark-900 hover:bg-dark-800 dark:hover:bg-dark-100'
                                }`}
                              >
                                {isSelected ? (
                                  <><Check className="w-3.5 h-3.5" /> Added</>
                                ) : (
                                  <><Plus className="w-3.5 h-3.5" /> Add</>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Selected Students */}
              <div className="bg-dark-50 dark:bg-dark-800/50 border border-dark-200 dark:border-dark-700 rounded-2xl p-5 flex flex-col h-[550px] lg:h-auto">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-dark-200 dark:border-dark-700">
                  <h4 className="font-bold text-dark-900 dark:text-white">Selected Students</h4>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    selectedStudents.length === MAX_STUDENTS 
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  }`}>
                    {selectedStudents.length} / {MAX_STUDENTS}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {selectedStudents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-dark-400">
                      <p className="text-sm">No students selected yet.</p>
                      <p className="text-xs mt-1">Search and add students from the left panel.</p>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {selectedStudents.map(s => (
                        <motion.div 
                          key={s.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20, scale: 0.95 }}
                          className="flex items-center justify-between p-3 bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-xl shadow-sm group"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-dark-900 dark:text-white truncate">{s.user?.full_name}</p>
                            <p className="text-xs text-dark-500 font-mono mt-0.5">{s.user?.ic_number}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleStudent(s)}
                            className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                            title="Remove student"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>

                {selectedStudents.length === MAX_STUDENTS && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 dark:text-red-400">
                      You have reached the maximum limit of {MAX_STUDENTS} students per team.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-dark-100 dark:border-dark-700 bg-dark-50/50 dark:bg-dark-800/50 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={onClose} className="btn-secondary px-6">Cancel</button>
              <button type="submit" disabled={isSubmitting || selectedStudents.length === 0} className="btn-primary px-8">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editing ? 'Update Team' : 'Create Team'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
